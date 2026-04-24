import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../../db/entities/corpus-ingest-log.entity';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { HcmApiService } from '../hcm/hcm-api.service';
import { createIntegrationApp } from 'test/create-integration-app';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let app: INestApplication;
  let service: SyncService;
  let ds: DataSource;

  afterEach(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    app = await createIntegrationApp({
      getBalance: jest.fn().mockResolvedValue({ balance: 25, version: 'v-hcm', leaveType: 'ANNUAL' }),
    });
    service = app.get(SyncService);
    ds = app.get(DataSource);
  });

  it('requires locationId for manual sync', async () => {
    const res = await service.triggerManualSync('EMP001', undefined);
    expect(res.queued).toBe(false);
    expect(res.message).toContain('locationId');
  });

  it('manual sync updates balances and writes audit logs', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-old',
    });

    const res = await service.triggerManualSync('EMP001', 'USA_HQ');
    expect(res.message).toContain('HCM_CORRECTION');

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(25);
    expect(bal.hcmVersion).toBe('v-hcm');

    const logs = await ds.getRepository(BalanceSyncLogEntity).find();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('reconciles with HCM winning on numeric conflict', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-old',
    });

    await service.reconcileWithHcmWins('EMP001', 'USA_HQ', 'ANNUAL');
    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(25);
  });

  it('processes a queued sync item', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 5,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-old',
    });

    service.enqueueSync('EMP001', 'USA_HQ');
    const processed = await service.processNextInQueue();
    expect(processed).toBe(true);
  });

  it('propagates HCM failures after retries', async () => {
    await app.close();
    app = await createIntegrationApp({
      getBalance: jest.fn().mockRejectedValue(new Error('boom')),
    });
    service = app.get(SyncService);
    await expect(service.fetchBalanceWithRetry('EMP001', 'USA_HQ')).rejects.toThrow();
  });

  it('reports degraded status when balances are stale', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 5,
      lastSyncedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      hcmVersion: 'v-old',
    });

    const status = await service.getSyncStatus('EMP001');
    expect(status.status).toBe('degraded');
  });

  it('ingests a balance corpus and writes sync logs', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 1,
      lastSyncedAt: new Date(),
      hcmVersion: 'v0',
    });

    const out = await service.ingestBalanceCorpus({
      idempotencyKey: 'unit-corpus-1',
      balances: [
        {
          employeeId: 'EMP001',
          locationId: 'USA_HQ',
          leaveType: 'ANNUAL',
          days: 99,
          version: 'v99',
        },
      ],
    });

    expect(out.applied).toBe(1);
    expect(out.errors).toHaveLength(0);
    expect(out.idempotentReplay).toBe(false);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(99);

    const replay = await service.ingestBalanceCorpus({
      idempotencyKey: 'unit-corpus-1',
      balances: [{ employeeId: 'EMP001', locationId: 'USA_HQ', leaveType: 'ANNUAL', days: 1 }],
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.applied).toBe(0);

    const logs = await ds.getRepository(BalanceSyncLogEntity).find({ where: { reason: 'HCM_CORPUS_INGEST' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('does not persist idempotency key when any corpus row fails', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });

    const out = await service.ingestBalanceCorpus({
      idempotencyKey: 'partial-fail-key',
      balances: [
        {
          employeeId: 'NOBODY',
          locationId: 'USA_HQ',
          leaveType: 'ANNUAL',
          days: 1,
        },
      ],
    });

    expect(out.applied).toBe(0);
    expect(out.errors.length).toBeGreaterThan(0);

    const logRow = await ds.getRepository(CorpusIngestLogEntity).findOne({ where: { idempotencyKey: 'partial-fail-key' } });
    expect(logRow).toBeNull();
  });
});

import request from 'supertest';
import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../../src/db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../src/db/entities/timeoff-balance.entity';
import { createIntegrationApp } from '../create-integration-app';

describe('Sync (integration)', () => {
  it('manual sync pulls authoritative balance from HCM and updates local rows', async () => {
    const app = await createIntegrationApp({
      getBalance: jest.fn().mockResolvedValue({ balance: 30, version: 'v-remote', leaveType: 'ANNUAL' }),
    });
    const ds = app.get(DataSource);

    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-old',
    });

    await request(app.getHttpServer()).post('/sync/manual/EMP001').query({ locationId: 'USA_HQ' }).expect(201);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(30);
    expect(bal.hcmVersion).toBe('v-remote');

    await app.close();
  });

  it('batch corpus ingest upserts balances and supports idempotent replay', async () => {
    const app = await createIntegrationApp();
    const ds = app.get(DataSource);

    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 1,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-old',
    });

    const body = {
      idempotencyKey: 'e2e-corpus-1',
      balances: [
        {
          employeeId: 'EMP001',
          locationId: 'USA_HQ',
          leaveType: 'ANNUAL',
          days: 42,
          version: 'v-corpus',
        },
      ],
    };

    const first = await request(app.getHttpServer()).post('/sync/batch').send(body).expect(200);
    expect(first.body.applied).toBe(1);
    expect(first.body.idempotentReplay).toBe(false);

    const second = await request(app.getHttpServer()).post('/sync/batch').send(body).expect(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.applied).toBe(0);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(42);
    expect(bal.hcmVersion).toBe('v-corpus');

    await app.close();
  });
});

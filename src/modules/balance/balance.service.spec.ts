import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConcurrencyException } from '../../common/exceptions/concurrency.exception';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { createIntegrationApp } from 'test/create-integration-app';
import { BalanceService } from './balance.service';

describe('BalanceService', () => {
  let app: INestApplication;
  let service: BalanceService;
  let ds: DataSource;

  afterEach(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    app = await createIntegrationApp();
    service = app.get(BalanceService);
    ds = app.get(DataSource);
  });

  it('fetches balance for employee × location × leave type', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 20,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    const dto = await service.getBalance('EMP001', 'USA_HQ', 'ANNUAL');
    expect(dto.availableDays).toBe(20);
    expect(dto.type).toBe('ANNUAL');
  });

  it('computes available days from totals', () => {
    expect(service.computeAvailableDays(20, 3)).toBe(17);
  });

  it('flags stale balances when lastSyncedAt is missing or old', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: old,
      hcmVersion: 'v1',
    });

    const dto = await service.getBalance('EMP001', 'USA_HQ');
    expect(dto.staleWarning).toBe(true);
  });

  it('throws for invalid dimensions when balance row is missing', async () => {
    await expect(service.getBalance('EMP001', 'USA_HQ')).rejects.toBeInstanceOf(InvalidDimensionsException);
  });

  it('detects version mismatches', async () => {
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    const bal = await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: new Date(),
      hcmVersion: 'v-real',
    });

    expect(() => service.assertVersionMatch(bal, 'v-other')).toThrow(ConcurrencyException);
  });
});

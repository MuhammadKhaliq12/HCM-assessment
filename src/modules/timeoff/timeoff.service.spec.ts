import { BadRequestException, INestApplication, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InsufficientBalanceException } from '../../common/exceptions/insufficient-balance.exception';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../../db/entities/timeoff-request.entity';
import { HcmApiService } from '../hcm/hcm-api.service';
import { createIntegrationApp } from 'test/create-integration-app';
import { CreateTimeoffRequestDto } from './dto/create-timeoff-request.dto';
import { STATUS_PENDING_MANAGER, TimeoffService } from './timeoff.service';

async function seedEmployeeAndBalance(ds: DataSource, days = 20): Promise<void> {
  const empRepo = ds.getRepository(EmployeeEntity);
  const balRepo = ds.getRepository(TimeOffBalanceEntity);
  await empRepo.save(
    empRepo.create({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John Doe' }),
  );
  await balRepo.save(
    balRepo.create({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    }),
  );
}

describe('TimeoffService', () => {
  let app: INestApplication;
  let service: TimeoffService;
  let ds: DataSource;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects invalid date ranges', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-02-10',
      endDate: '2026-02-01',
      days: 1,
    };

    await expect(service.requestTimeOff(dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown employee/location dimensions', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'UNKNOWN',
      locationId: 'USA_HQ',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      days: 1,
    };

    await expect(service.requestTimeOff(dto)).rejects.toBeInstanceOf(InvalidDimensionsException);
  });

  it('rejects insufficient balance at submission', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds, 1);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      days: 5,
    };

    await expect(service.requestTimeOff(dto)).rejects.toBeInstanceOf(InsufficientBalanceException);
  });

  it('creates a PENDING_MANAGER request without calling HCM', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds, 20);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      days: 3,
      leaveType: 'ANNUAL',
    };

    const res = await service.requestTimeOff(dto);
    expect(res.status).toBe(STATUS_PENDING_MANAGER);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneBy({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal?.days).toBe(20);

    const hcm = app.get(HcmApiService) as unknown as { createTimeoff: jest.Mock };
    expect(hcm.createTimeoff).not.toHaveBeenCalled();
  });

  it('blocks the second manager approval when balance no longer covers the pending request', async () => {
    let remoteBal = 5;
    app = await createIntegrationApp({
      getBalance: jest.fn().mockImplementation(async () => ({
        balance: remoteBal,
        version: 'v1',
        leaveType: 'ANNUAL',
      })),
      createTimeoff: jest.fn().mockImplementation(async (body: { days: number }) => {
        remoteBal = Number((remoteBal - body.days).toFixed(2));
        return { success: true, newBalance: remoteBal, hcmRefId: 'hcm-ref', version: 'v2' };
      }),
    });
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds, 5);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      days: 3,
    };

    const r1 = await service.requestTimeOff(dto);
    const r2 = await service.requestTimeOff(dto);
    expect(r1.status).toBe(STATUS_PENDING_MANAGER);
    expect(r2.status).toBe(STATUS_PENDING_MANAGER);

    const key = process.env.MANAGER_API_KEY!;
    await service.managerApproveRequest(r1.id, key);
    await expect(service.managerApproveRequest(r2.id, key)).rejects.toBeInstanceOf(InsufficientBalanceException);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneBy({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal?.days).toBe(2);
  });

  it('rejects manager approval with a bad API key', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds, 20);

    const dto: CreateTimeoffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      days: 1,
    };
    const { id } = await service.requestTimeOff(dto);
    await expect(service.managerApproveRequest(id, 'wrong-key')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('supports cancellation and manager approval workflows', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    service = app.get(TimeoffService);
    await seedEmployeeAndBalance(ds, 20);

    const repo = ds.getRepository(TimeOffRequestEntity);
    const pending = repo.create({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      leaveType: 'ANNUAL',
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      days: 1,
      status: STATUS_PENDING_MANAGER,
      requestedAt: new Date(),
    });
    const saved = await repo.save(pending);

    await service.cancelRequest('EMP001', saved.id);
    const cancelled = await repo.findOneByOrFail({ id: saved.id });
    expect(cancelled.status).toBe('CANCELLED');

    const pending2 = await repo.save(
      repo.create({
        employeeId: 'EMP001',
        locationId: 'USA_HQ',
        leaveType: 'ANNUAL',
        startDate: '2026-03-03',
        endDate: '2026-03-04',
        days: 1,
        status: STATUS_PENDING_MANAGER,
        requestedAt: new Date(),
      }),
    );

    await service.approveRequest('EMP001', pending2.id);
    const approved = await repo.findOneByOrFail({ id: pending2.id });
    expect(approved.status).toBe('APPROVED');
  });

  it('throws when cancelling missing requests', async () => {
    app = await createIntegrationApp();
    service = app.get(TimeoffService);
    await expect(service.cancelRequest('EMP001', 999999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

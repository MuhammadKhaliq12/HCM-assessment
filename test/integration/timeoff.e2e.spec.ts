import request from 'supertest';
import { DataSource } from 'typeorm';
import { BalanceSyncLogEntity } from '../../src/db/entities/balance-sync-log.entity';
import { EmployeeEntity } from '../../src/db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../src/db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../../src/db/entities/timeoff-request.entity';
import { HcmApiService } from '../../src/modules/hcm/hcm-api.service';
import { createIntegrationApp } from '../create-integration-app';

describe('Timeoff (integration)', () => {
  it('creates a pending request, manager approves, balance updates, audit log written', async () => {
    const app = await createIntegrationApp();
    const ds = app.get(DataSource);
    const managerKey = process.env.MANAGER_API_KEY!;

    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 20,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    const res = await request(app.getHttpServer())
      .post('/timeoff/request')
      .send({
        employeeId: 'EMP001',
        locationId: 'USA_HQ',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        days: 2,
        leaveType: 'ANNUAL',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING_MANAGER');

    const requests = await ds.getRepository(TimeOffRequestEntity).find();
    expect(requests).toHaveLength(1);

    let bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(20);

    const approve = await request(app.getHttpServer())
      .post(`/timeoff/requests/${res.body.id}/approve`)
      .set('x-manager-api-key', managerKey)
      .expect(200);

    expect(approve.body.status).toBe('APPROVED');

    bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(18);

    const logs = await ds.getRepository(BalanceSyncLogEntity).find();
    expect(logs.length).toBeGreaterThan(0);

    const hcm = app.get(HcmApiService) as unknown as { createTimeoff: jest.Mock };
    expect(hcm.createTimeoff).toHaveBeenCalled();

    await app.close();
  });
});

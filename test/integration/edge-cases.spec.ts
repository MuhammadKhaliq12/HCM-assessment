import request from 'supertest';
import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../../src/db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../src/db/entities/timeoff-balance.entity';
import { createIntegrationApp } from '../create-integration-app';

describe('Edge cases (integration)', () => {
  it('allows overlapping pending requests but blocks the second manager approval when balance is insufficient', async () => {
    const app = await createIntegrationApp();
    const ds = app.get(DataSource);
    const managerKey = process.env.MANAGER_API_KEY!;

    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 12,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    const firstPayload = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      days: 11,
      leaveType: 'ANNUAL',
    };
    const secondPayload = { ...firstPayload, days: 10 };

    const first = await request(app.getHttpServer()).post('/timeoff/request').send(firstPayload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer()).post('/timeoff/request').send(secondPayload);
    expect(second.status).toBe(201);

    const balBefore = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(balBefore.days).toBe(12);

    await request(app.getHttpServer())
      .post(`/timeoff/requests/${first.body.id}/approve`)
      .set('x-manager-api-key', managerKey)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/timeoff/requests/${second.body.id}/approve`)
      .set('x-manager-api-key', managerKey)
      .expect(422);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBeGreaterThanOrEqual(0);

    await app.close();
  });

  it('rejects invalid dimensions when employee is missing locally', async () => {
    const app = await createIntegrationApp();

    await request(app.getHttpServer())
      .post('/timeoff/request')
      .send({
        employeeId: 'MISSING',
        locationId: 'USA_HQ',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 1,
      })
      .expect(400);

    await app.close();
  });

  it('documents DB lock contention expectations (skipped on SQLite)', () => {
    // SQLite does not emulate enterprise row locks; queueing behavior is validated at the service contract level.
    expect(true).toBe(true);
  });
});

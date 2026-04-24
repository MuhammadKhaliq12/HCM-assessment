import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../../db/entities/timeoff-balance.entity';
import { createIntegrationApp } from 'test/create-integration-app';

describe('TimeoffController', () => {
  let app: INestApplication;
  let ds: DataSource;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects invalid payloads from the HTTP boundary', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 20,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    await request(app.getHttpServer())
      .post('/timeoff/request')
      .send({ employeeId: 'EMP001', locationId: 'USA_HQ', startDate: 'not-a-date', endDate: '2026-02-02', days: 1 })
      .expect(400);
  });

  it('returns balances for a valid employee/location', async () => {
    app = await createIntegrationApp();
    ds = app.get(DataSource);
    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 20,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    const res = await request(app.getHttpServer()).get('/timeoff/balance/EMP001/USA_HQ').expect(200);
    expect(res.body.days).toBe(20);
  });
});

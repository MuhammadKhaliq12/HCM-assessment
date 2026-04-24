import express from 'express';
import request from 'supertest';
import { attachMockHcmRoutes } from '../../mock-hcm/src/http';
import { HcmStore } from '../../mock-hcm/src/hcm.store';

describe('Mock HCM (integration)', () => {
  it('exposes /mock routes with deterministic behavior when failure injection is disabled', async () => {
    const app = express();
    app.use(express.json());
    const store = new HcmStore();
    attachMockHcmRoutes(app, store, { injectFailures: false });

    await request(app).get('/mock/health').expect(200);

    const bal = await request(app).get('/mock/balance/EMP001/USA_HQ').expect(200);
    expect(typeof bal.body.balance).toBe('number');
    expect(bal.body.version).toBeDefined();

    const created = await request(app)
      .post('/mock/timeoff/create')
      .send({ employeeId: 'EMP001', locationId: 'USA_HQ', days: 2, leaveType: 'ANNUAL' })
      .expect(200);

    expect(created.body.newBalance).toBeDefined();

    const synced = await request(app)
      .post('/mock/balance/sync')
      .send({ records: [{ employeeId: 'EMP001', locationId: 'USA_HQ', balance: 40, leaveType: 'ANNUAL' }] })
      .expect(200);

    expect(synced.body.synced.length).toBeGreaterThan(0);

    await request(app).post('/mock/reset').expect(200);
  });
});

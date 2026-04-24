import request from 'supertest';
import { DataSource } from 'typeorm';
import { TimeOffBalanceEntity } from '../../src/db/entities/timeoff-balance.entity';
import { createIntegrationApp } from '../create-integration-app';
import { signWebhook } from '../fixtures/webhook-signature.util';

const flushJobs = async (): Promise<void> => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setTimeout(r, 25));
};

async function waitForBalanceDays(
  ds: DataSource,
  expected: number,
  timeoutMs = 20000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneBy({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    if (bal && Number(bal.days) === expected) {
      return;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  const final = await ds.getRepository(TimeOffBalanceEntity).findOneBy({ employeeId: 'EMP001', locationId: 'USA_HQ' });
  throw new Error(`Timeout waiting for balance=${expected}, last=${final?.days ?? 'null'}`);
}

describe('Webhooks (integration)', () => {
  it('accepts signed webhooks and updates balances asynchronously', async () => {
    process.env.HCM_WEBHOOK_SECRET = 'test-webhook-secret';

    const app = await createIntegrationApp();
    const ds = app.get(DataSource);
    try {
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 5,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });

    const event = 'balance.updated';
    const eventId = 'evt-int-1';
    const payload = { employeeId: 'EMP001', locationId: 'USA_HQ', leaveType: 'ANNUAL', balance: 9, version: 'v99' };
    const signature = signWebhook(process.env.HCM_WEBHOOK_SECRET, event, eventId);

    await request(app.getHttpServer())
      .post('/webhooks/hcm')
      .set('x-hcm-signature', signature)
      .send({ event, eventId, payload })
      .expect(201);

    await flushJobs();
    await waitForBalanceDays(ds, 9);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(9);

    await request(app.getHttpServer())
      .post('/webhooks/hcm')
      .set('x-hcm-signature', signature)
      .send({ event, eventId, payload })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    } finally {
      await app.close();
    }
  });
});

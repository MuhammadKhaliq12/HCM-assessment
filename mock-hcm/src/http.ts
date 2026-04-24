import express, { Express, NextFunction, Request, Response } from 'express';
import { HcmStore } from './hcm.store';

export type MockHcmHttpOptions = {
  /** When false, disables random latency/error injection (used by automated tests). */
  injectFailures?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomLatencyMs(): number {
  return 50 + Math.floor(Math.random() * 101);
}

async function maybeInjectBehavior(opts: MockHcmHttpOptions): Promise<void> {
  if (opts.injectFailures === false) {
    return;
  }

  const r = Math.random();
  if (r < 0.02) {
    await sleep(6000);
    throw Object.assign(new Error('TIMEOUT'), { status: 503 });
  }
  if (r < 0.03) {
    throw Object.assign(new Error('INTERNAL'), { status: 500 });
  }
  if (r < 0.08) {
    const t = Math.random();
    if (t < 0.5) {
      throw Object.assign(new Error('INSUFFICIENT_BALANCE'), { status: 400, code: 'INSUFFICIENT_BALANCE' });
    }
    throw Object.assign(new Error('INVALID_EMPLOYEE'), { status: 404, code: 'INVALID_EMPLOYEE' });
  }
}

async function withMockBehavior(
  store: HcmStore,
  opts: MockHcmHttpOptions,
  req: Request,
  res: Response,
  handler: () => Promise<unknown> | unknown,
): Promise<void> {
  const started = Date.now();
  try {
    if (opts.injectFailures !== false) {
      await sleep(randomLatencyMs());
    }
    await maybeInjectBehavior(opts);
    const body = await handler();
    const durationMs = Date.now() - started;
    store.logRequest({ ts: new Date().toISOString(), method: req.method, path: req.path, durationMs, status: 200 });
    res.json(body);
  } catch (e) {
    const durationMs = Date.now() - started;
    const err = e as { status?: number; code?: string; message?: string };
    const status = err.status ?? 503;
    store.logRequest({ ts: new Date().toISOString(), method: req.method, path: req.path, durationMs, status });
    if (status === 400 && err.code === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: 'INSUFFICIENT_BALANCE', required: 5, available: 2 });
      return;
    }
    if (status === 404) {
      res.status(404).json({ error: 'INVALID_EMPLOYEE' });
      return;
    }
    if (status === 500) {
      res.status(500).json({ error: 'HCM_INTERNAL' });
      return;
    }
    res.status(503).json({ error: 'TIMEOUT', message: 'HCM API did not respond within 5s' });
  }
}

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => void fn(req, res, next).catch(next);
}

/**
 * Registers mock HCM routes on an Express app instance.
 */
export function attachMockHcmRoutes(app: Express, store: HcmStore, opts: MockHcmHttpOptions = {}): void {
  app.get(
    '/mock/health',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => store.health());
    }),
  );

  app.get(
    '/mock/balance/:empId/:locId',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const leaveType = String(req.query.leaveType ?? 'ANNUAL');
        return store.getBalance(req.params.empId, req.params.locId, leaveType);
      });
    }),
  );

  app.post(
    '/mock/timeoff/create',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const { employeeId, locationId, days, leaveType } = req.body as {
          employeeId: string;
          locationId: string;
          days: number;
          leaveType?: string;
        };
        return store.createTimeOff({ employeeId, locationId, days: Number(days ?? 0), leaveType });
      });
    }),
  );

  app.post(
    '/mock/balance/sync',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const records = (req.body as { records?: unknown }).records as
          | Array<{ employeeId: string; locationId: string; balance?: number; leaveType?: string }>
          | undefined;
        return store.batchSync(records ?? []);
      });
    }),
  );

  app.post(
    '/mock/balance/refresh/:empId',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const locationId = String((req.body as { locationId?: string })?.locationId ?? '');
        const leaveType = String((req.body as { leaveType?: string })?.leaveType ?? 'ANNUAL');
        return store.refresh(req.params.empId, locationId, leaveType);
      });
    }),
  );

  app.post('/mock/simulate-drift', (_req, res) => {
    const record = store.simulateDrift();
    res.json({ ok: true, record });
  });

  app.post('/mock/reset', (_req, res) => {
    store.reset();
    res.json({ ok: true });
  });

  app.get(
    '/hcm/balance/:employeeId/:locationId',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const leaveType = String(req.query.leaveType ?? 'ANNUAL');
        return store.getBalance(req.params.employeeId, req.params.locationId, leaveType);
      });
    }),
  );

  app.post(
    '/hcm/timeoff/create',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const { employeeId, locationId, days, leaveType } = req.body as {
          employeeId: string;
          locationId: string;
          days: number;
          leaveType?: string;
        };
        return store.createTimeOff({ employeeId, locationId, days: Number(days ?? 0), leaveType });
      });
    }),
  );

  app.post(
    '/hcm/sync/batch',
    asyncRoute(async (req, res) => {
      await withMockBehavior(store, opts, req, res, () => {
        const records = (req.body as { records?: unknown }).records as
          | Array<{ employeeId: string; locationId: string; balance?: number; leaveType?: string }>
          | undefined;
        return store.batchSync(records ?? []);
      });
    }),
  );
}

import http from 'http';
import { AddressInfo } from 'net';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { TimeoutException } from '../../common/exceptions/timeout.exception';
import { HcmApiService } from './hcm-api.service';

async function startServer(handler: http.RequestListener): Promise<{ server: http.Server; baseUrl: string }> {
  return await new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe('HcmApiService', () => {
  let previousUrl: string | undefined;

  beforeEach(() => {
    previousUrl = process.env.HCM_API_URL;
  });

  afterEach(async () => {
    process.env.HCM_API_URL = previousUrl;
  });

  it('GET /mock/balance maps responses and retries on 500', async () => {
    let calls = 0;
    const { server, baseUrl } = await startServer((req, res) => {
      if (req.url?.startsWith('/mock/balance/')) {
        calls += 1;
        if (calls === 1) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'HCM_INTERNAL' }));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ balance: 12, version: 'v-ok', leaveType: 'ANNUAL' }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    process.env.HCM_API_URL = baseUrl;
    const svc = new HcmApiService();
    const bal = await svc.getBalance('EMP001', 'USA_HQ');
    expect(bal.balance).toBe(12);
    expect(calls).toBeGreaterThanOrEqual(2);
    await new Promise((r) => server.close(() => r(undefined)));
  });

  it('maps 404 to InvalidDimensions', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'INVALID_EMPLOYEE' }));
    });
    process.env.HCM_API_URL = baseUrl;
    const svc = new HcmApiService();
    await expect(svc.getBalance('X', 'Y')).rejects.toBeInstanceOf(InvalidDimensionsException);
    await new Promise((r) => server.close(() => r(undefined)));
  });

  it('maps 503 TIMEOUT payloads to TimeoutException', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'TIMEOUT', message: 'slow' }));
    });
    process.env.HCM_API_URL = baseUrl;
    const svc = new HcmApiService();
    await expect(svc.getBalance('EMP001', 'USA_HQ')).rejects.toBeInstanceOf(TimeoutException);
    await new Promise((r) => server.close(() => r(undefined)));
  });
});

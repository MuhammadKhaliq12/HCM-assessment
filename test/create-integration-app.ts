import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HcmApiService } from '../src/modules/hcm/hcm-api.service';
import { TestAppModule } from './test-app.module';

export type HcmApiMock = Pick<HcmApiService, 'getBalance' | 'createTimeoff' | 'batchBalanceSync'> & {
  requestWithRetry: HcmApiService['requestWithRetry'];
};

/**
 * Boots a Nest app wired like production, but backed by in-memory SQLite.
 */
export async function createIntegrationApp(hcmOverrides: Partial<HcmApiMock> = {}): Promise<INestApplication> {
  const getBalance = jest.fn().mockResolvedValue({ balance: 20, version: 'v-remote', leaveType: 'ANNUAL' });

  const createTimeoff = jest.fn().mockImplementation(async (body: { employeeId: string; locationId: string; days: number; leaveType?: string }) => {
    const remote = await getBalance(body.employeeId, body.locationId, body.leaveType);
    const newBalance = Number((Number(remote.balance) - Number(body.days)).toFixed(2));
    return { success: true, newBalance, hcmRefId: `HCM-${Date.now()}`, version: `${remote.version}-mut` };
  });

  const batchBalanceSync = jest.fn().mockResolvedValue({ synced: [], errors: [] });
  const requestWithRetry: HcmApiService['requestWithRetry'] = async (fn) => fn();

  const hcmApi: HcmApiMock = {
    getBalance,
    createTimeoff,
    batchBalanceSync,
    requestWithRetry,
  };

  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  })
    .overrideProvider(HcmApiService)
    .useValue({ ...hcmApi, ...hcmOverrides })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

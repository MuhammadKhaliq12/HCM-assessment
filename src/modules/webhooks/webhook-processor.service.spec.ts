import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { HcmWebhookEntity } from '../../db/entities/hcm-webhook.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../../db/entities/timeoff-request.entity';
import { HcmWebhookDto } from '../hcm/dto/hcm-webhook.dto';
import { WebhookProcessorService } from './webhook-processor.service';
import { WebhooksModule } from './webhooks.module';
import { signWebhook } from 'test/fixtures/webhook-signature.util';

describe('WebhookProcessorService', () => {
  let app: INestApplication;
  let processor: WebhookProcessorService;
  let ds: DataSource;

  beforeEach(async () => {
    process.env.HCM_WEBHOOK_SECRET = 'secret';

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [EmployeeEntity, TimeOffBalanceEntity, TimeOffRequestEntity, BalanceSyncLogEntity, HcmWebhookEntity],
          synchronize: true,
          logging: false,
        }),
        WebhooksModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    processor = app.get(WebhookProcessorService);
    ds = app.get(DataSource);

    await ds.getRepository(EmployeeEntity).save({ employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John' });
    await ds.getRepository(TimeOffBalanceEntity).save({
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      type: 'ANNUAL',
      days: 10,
      lastSyncedAt: new Date(),
      hcmVersion: 'v1',
    });
  }, 60_000);

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 120));
    await app?.close();
  }, 30_000);

  it('validates webhook signatures', async () => {
    const dto: HcmWebhookDto = {
      event: 'balance.updated',
      payload: { employeeId: 'EMP001', locationId: 'USA_HQ', leaveType: 'ANNUAL', balance: 11, version: 'v2' },
      eventId: 'evt-1',
    };
    const sig = signWebhook(process.env.HCM_WEBHOOK_SECRET!, dto.event, dto.eventId!);

    const res = await processor.acceptAndProcessAsync(dto, sig);
    expect(res.received).toBe(true);
  });

  it('rejects invalid signatures', async () => {
    const dto: HcmWebhookDto = {
      event: 'balance.updated',
      payload: { employeeId: 'EMP001', locationId: 'USA_HQ', leaveType: 'ANNUAL', balance: 11, version: 'v2' },
      eventId: 'evt-2',
    };

    const res = await processor.acceptAndProcessAsync(dto, 'bad-sig');
    expect(res.received).toBe(false);
  });

  it('routes balance.updated events and is idempotent for duplicate event ids', async () => {
    const dto: HcmWebhookDto = {
      event: 'balance.updated',
      payload: { employeeId: 'EMP001', locationId: 'USA_HQ', leaveType: 'ANNUAL', balance: 14, version: 'v3' },
      eventId: 'evt-3',
    };
    const sig = signWebhook(process.env.HCM_WEBHOOK_SECRET!, dto.event, dto.eventId!);

    await processor.processInline(dto, sig);
    await processor.processInline(dto, sig);

    const bal = await ds.getRepository(TimeOffBalanceEntity).findOneByOrFail({ employeeId: 'EMP001', locationId: 'USA_HQ' });
    expect(bal.days).toBe(14);
  });
});

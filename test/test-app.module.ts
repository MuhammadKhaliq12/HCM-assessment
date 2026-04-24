import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLoggingMiddleware } from '../src/common/middleware/error-logging.middleware';
import { BalanceSyncLogEntity } from '../src/db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../src/db/entities/corpus-ingest-log.entity';
import { EmployeeEntity } from '../src/db/entities/employee.entity';
import { HcmWebhookEntity } from '../src/db/entities/hcm-webhook.entity';
import { TimeOffBalanceEntity } from '../src/db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../src/db/entities/timeoff-request.entity';
import { BalanceModule } from '../src/modules/balance/balance.module';
import { HcmModule } from '../src/modules/hcm/hcm.module';
import { SyncModule } from '../src/modules/sync/sync.module';
import { TimeoffModule } from '../src/modules/timeoff/timeoff.module';

/**
 * Test Nest module with in-memory SQLite (no migration files required).
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [
        EmployeeEntity,
        TimeOffBalanceEntity,
        TimeOffRequestEntity,
        BalanceSyncLogEntity,
        HcmWebhookEntity,
        CorpusIngestLogEntity,
      ],
      synchronize: true,
      logging: false,
    }),
    TimeoffModule,
    BalanceModule,
    SyncModule,
    HcmModule,
  ],
})
export class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorLoggingMiddleware).forRoutes('*');
  }
}

import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { EmployeeEntity } from '../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../db/entities/timeoff-request.entity';
import { BalanceSyncLogEntity } from '../db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../db/entities/corpus-ingest-log.entity';
import { HcmWebhookEntity } from '../db/entities/hcm-webhook.entity';

/**
 * TypeORM configuration using environment variables (no @nestjs/config).
 */
export const typeOrmConfigFactory: TypeOrmModuleAsyncOptions = {
  useFactory: (): DataSourceOptions => ({
    type: 'sqlite',
    database: process.env.DB_PATH ?? './data/timeoff.sqlite',
    entities: [
      EmployeeEntity,
      TimeOffBalanceEntity,
      TimeOffRequestEntity,
      BalanceSyncLogEntity,
      HcmWebhookEntity,
      CorpusIngestLogEntity,
    ],
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true' ? ['error', 'warn'] : false,
    migrations: ['dist/db/migrations/*.js'],
  }),
};

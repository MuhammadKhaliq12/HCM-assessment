import 'dotenv/config';
import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../db/entities/timeoff-request.entity';
import { BalanceSyncLogEntity } from '../db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../db/entities/corpus-ingest-log.entity';
import { HcmWebhookEntity } from '../db/entities/hcm-webhook.entity';

/**
 * Data source used by TypeORM CLI for migrations.
 */
const AppDataSource = new DataSource({
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
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;

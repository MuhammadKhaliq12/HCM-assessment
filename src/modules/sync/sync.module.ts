import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../../db/entities/corpus-ingest-log.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { HcmModule } from '../hcm/hcm.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

/**
 * Handles manual sync and sync health endpoints.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffBalanceEntity, BalanceSyncLogEntity, CorpusIngestLogEntity]),
    HcmModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

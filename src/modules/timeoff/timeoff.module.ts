import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../../db/entities/timeoff-request.entity';
import { BalanceModule } from '../balance/balance.module';
import { HcmModule } from '../hcm/hcm.module';
import { TimeoffController } from './controllers/timeoff.controller';
import { TimeoffService } from './timeoff.service';

/**
 * Handles time-off request and query endpoints.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequestEntity, TimeOffBalanceEntity, EmployeeEntity, BalanceSyncLogEntity]),
    BalanceModule,
    HcmModule,
  ],
  controllers: [TimeoffController],
  providers: [TimeoffService],
  exports: [TimeoffService],
})
export class TimeoffModule {}

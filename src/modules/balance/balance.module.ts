import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { BalanceController } from './controllers/balance.controller';
import { BalanceService } from './balance.service';

/**
 * Encapsulates balance read APIs and structures.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TimeOffBalanceEntity])],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}

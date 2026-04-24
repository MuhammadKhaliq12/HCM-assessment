import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfigFactory } from './config/typeorm.config';
import { TimeoffModule } from './modules/timeoff/timeoff.module';
import { BalanceModule } from './modules/balance/balance.module';
import { SyncModule } from './modules/sync/sync.module';
import { HcmModule } from './modules/hcm/hcm.module';
import { ErrorLoggingMiddleware } from './common/middleware/error-logging.middleware';

/**
 * Root module for the Time-Off microservice.
 */
@Module({
  imports: [TypeOrmModule.forRootAsync(typeOrmConfigFactory), TimeoffModule, BalanceModule, SyncModule, HcmModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorLoggingMiddleware).forRoutes('*');
  }
}

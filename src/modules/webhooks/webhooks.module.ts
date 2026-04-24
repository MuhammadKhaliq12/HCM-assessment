import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HcmWebhookEntity } from '../../db/entities/hcm-webhook.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { WebhookProcessorService } from './webhook-processor.service';

/**
 * Webhook ingestion and async processing wiring.
 */
@Module({
  imports: [TypeOrmModule.forFeature([HcmWebhookEntity, TimeOffBalanceEntity])],
  providers: [WebhookProcessorService],
  exports: [WebhookProcessorService],
})
export class WebhooksModule {}

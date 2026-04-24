import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { HcmApiService } from './hcm-api.service';
import { HcmController } from './hcm.controller';
import { HcmService } from './hcm.service';

/**
 * Handles inbound HCM webhook integration points and outbound HCM API access.
 */
@Module({
  imports: [WebhooksModule],
  controllers: [HcmController],
  providers: [HcmService, HcmApiService],
  exports: [HcmService, HcmApiService],
})
export class HcmModule {}

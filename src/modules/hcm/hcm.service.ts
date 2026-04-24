import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { WebhookProcessorService } from '../webhooks/webhook-processor.service';
import { HcmWebhookDto } from './dto/hcm-webhook.dto';
import { HcmWebhookResponseDto } from './dto/hcm-webhook-response.dto';

/**
 * HCM-facing façade that delegates webhook ingestion to the processor.
 */
@Injectable()
export class HcmService {
  constructor(private readonly webhookProcessor: WebhookProcessorService) {}

  async handleWebhook(payload: HcmWebhookDto, signatureHeader?: string): Promise<HcmWebhookResponseDto> {
    const dto: HcmWebhookDto = {
      ...payload,
      eventId: payload.eventId ?? '',
    };

    const result = await this.webhookProcessor.acceptAndProcessAsync(dto, signatureHeader);

    if (!result.received && result.message.toLowerCase().includes('signature')) {
      throw new UnauthorizedException(result.message);
    }

    if (!result.received) {
      throw new BadRequestException(result.message);
    }

    return { received: true, message: result.message };
  }
}

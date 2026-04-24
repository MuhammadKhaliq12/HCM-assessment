import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebhookProcessorService } from '../webhooks/webhook-processor.service';
import { HcmWebhookDto } from './dto/hcm-webhook.dto';
import { HcmService } from './hcm.service';

describe('HcmService', () => {
  it('maps non-signature failures to bad request errors', async () => {
    const processor = { acceptAndProcessAsync: jest.fn().mockResolvedValue({ received: false, message: 'nope' }) };
    const moduleRef = await Test.createTestingModule({
      providers: [HcmService, { provide: WebhookProcessorService, useValue: processor }],
    }).compile();

    const service = moduleRef.get(HcmService);
    const dto: HcmWebhookDto = { event: 'balance.updated', payload: {}, eventId: 'x' };

    await expect(service.handleWebhook(dto, 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps invalid signatures to HTTP errors', async () => {
    const processor = { acceptAndProcessAsync: jest.fn().mockResolvedValue({ received: false, message: 'Invalid webhook signature.' }) };
    const moduleRef = await Test.createTestingModule({
      providers: [HcmService, { provide: WebhookProcessorService, useValue: processor }],
    }).compile();

    const service = moduleRef.get(HcmService);
    const dto: HcmWebhookDto = { event: 'balance.updated', payload: {}, eventId: 'x' };

    await expect(service.handleWebhook(dto, 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

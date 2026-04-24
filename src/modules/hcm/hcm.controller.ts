import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HcmWebhookDto } from './dto/hcm-webhook.dto';
import { HcmWebhookResponseDto } from './dto/hcm-webhook-response.dto';
import { HcmService } from './hcm.service';

/**
 * Exposes inbound webhook endpoint for external HCM updates.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class HcmController {
  constructor(private readonly hcmService: HcmService) {}

  @Post('hcm')
  @ApiOperation({ summary: 'Inbound HCM webhook (balance drift, etc.)' })
  @ApiHeader({ name: 'x-hcm-signature', required: false, description: 'HMAC SHA-256 of raw body' })
  @ApiBody({ type: HcmWebhookDto })
  @ApiOkResponse({ type: HcmWebhookResponseDto })
  async webhook(
    @Body() payload: HcmWebhookDto,
    @Headers('x-hcm-signature') signature?: string,
  ): Promise<HcmWebhookResponseDto> {
    return this.hcmService.handleWebhook(payload, signature);
  }
}

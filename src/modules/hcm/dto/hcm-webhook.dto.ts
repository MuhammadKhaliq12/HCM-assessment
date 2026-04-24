import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO for incoming HCM webhook requests.
 */
export class HcmWebhookDto {
  @IsString()
  event!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  signature?: string;
}

/**
 * Output DTO for webhook ingestion acknowledgment.
 */
export class HcmWebhookResponseDto {
  received!: boolean;
  message!: string;
}

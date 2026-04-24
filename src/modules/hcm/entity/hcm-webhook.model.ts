/**
 * Module-level model for webhook events.
 */
export interface HcmWebhookModel {
  event: string;
  payload: Record<string, unknown>;
  processedAt: string | null;
}

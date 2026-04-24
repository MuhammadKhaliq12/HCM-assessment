import { createHmac } from 'crypto';

/**
 * Builds the shared secret signature expected by `WebhookProcessorService`.
 */
export function signWebhook(secret: string, event: string, eventId: string): string {
  return createHmac('sha256', secret).update(`${event}:${eventId}`).digest('hex');
}

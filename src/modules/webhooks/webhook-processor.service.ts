import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HcmWebhookEntity } from '../../db/entities/hcm-webhook.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { HcmWebhookDto } from '../hcm/dto/hcm-webhook.dto';

/**
 * Validates, deduplicates, and applies HCM webhook events to local balances.
 */
@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    @InjectRepository(HcmWebhookEntity)
    private readonly webhookRepo: Repository<HcmWebhookEntity>,
    @InjectRepository(TimeOffBalanceEntity)
    private readonly balanceRepo: Repository<TimeOffBalanceEntity>,
  ) {}

  /**
   * Validates signature and enqueues async processing (non-blocking for HTTP handler).
   */
  async acceptAndProcessAsync(dto: HcmWebhookDto, rawSignature?: string): Promise<{ received: boolean; message: string }> {
    if (!this.isSignatureValid(dto, rawSignature)) {
      return { received: false, message: 'Invalid webhook signature.' };
    }

    const externalEventId = dto.eventId;
    const existing = externalEventId
      ? await this.webhookRepo.findOne({ where: { externalEventId } })
      : null;
    if (existing?.processedAt) {
      return { received: true, message: 'Duplicate event ignored (idempotent).' };
    }

    const row = this.webhookRepo.create({
      event: dto.event,
      payload: JSON.stringify(dto.payload),
      externalEventId: externalEventId ?? null,
      processedAt: null,
    });

    try {
      await this.webhookRepo.save(row);
    } catch (e) {
      // Unique violation → duplicate in-flight
      this.logger.warn(`Duplicate webhook externalEventId=${externalEventId}`);
      return { received: true, message: 'Duplicate event ignored (idempotent).' };
    }

    setImmediate(() => {
      void this.processRow(row.id).catch((err) => this.logger.error(`Webhook processing failed id=${row.id}`, err));
    });

    return { received: true, message: 'Webhook accepted for async processing.' };
  }

  /**
   * Synchronous processing for unit tests and deterministic flows.
   */
  async processInline(dto: HcmWebhookDto, rawSignature?: string): Promise<void> {
    if (!this.isSignatureValid(dto, rawSignature)) {
      throw new Error('Invalid webhook signature.');
    }
    await this.applyEvent(dto);
  }

  private async processRow(id: number): Promise<void> {
    const row = await this.webhookRepo.findOne({ where: { id } });
    if (!row || row.processedAt) {
      return;
    }

    const dto: HcmWebhookDto = {
      event: row.event,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      eventId: row.externalEventId ?? '',
    };

    await this.applyEvent(dto);

    row.processedAt = new Date();
    await this.webhookRepo.save(row);
  }

  private isSignatureValid(dto: HcmWebhookDto, rawSignature?: string): boolean {
    const secret = process.env.HCM_WEBHOOK_SECRET ?? '';
    if (!secret) {
      return true;
    }

    if (!dto.eventId) {
      return false;
    }

    const signature = rawSignature ?? dto.signature ?? '';
    const expected = createHmac('sha256', secret).update(`${dto.event}:${dto.eventId}`).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private async applyEvent(dto: HcmWebhookDto): Promise<void> {
    if (dto.event === 'balance.updated' || dto.event === 'leave.approved') {
      const data = dto.payload as {
        employeeId?: string;
        locationId?: string;
        leaveType?: string;
        balance?: number;
        version?: string;
      };

      if (!data.employeeId || !data.locationId || typeof data.balance !== 'number') {
        this.logger.warn('Webhook payload missing balance fields; skipping.');
        return;
      }

      const leaveType = (data.leaveType ?? 'ANNUAL').toUpperCase();
      let balance = await this.balanceRepo.findOne({
        where: { employeeId: data.employeeId, locationId: data.locationId, type: leaveType },
      });

      if (!balance) {
        balance = this.balanceRepo.create({
          employeeId: data.employeeId,
          locationId: data.locationId,
          type: leaveType,
          days: data.balance,
          lastSyncedAt: new Date(),
          hcmVersion: data.version ?? null,
        });
      } else {
        balance.days = data.balance;
        balance.lastSyncedAt = new Date();
        balance.hcmVersion = data.version ?? balance.hcmVersion;
      }

      await this.balanceRepo.save(balance);
    }
  }
}

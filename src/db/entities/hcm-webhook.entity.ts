import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores incoming webhook payloads for traceability.
 */
@Entity({ name: 'hcmWebhooks' })
export class HcmWebhookEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  event!: string;

  @Column({ type: 'text' })
  payload!: string;

  @Column({ type: 'varchar', length: 120, nullable: true, unique: true })
  externalEventId!: string | null;

  @Column({ type: 'datetime', nullable: true })
  processedAt!: Date | null;
}

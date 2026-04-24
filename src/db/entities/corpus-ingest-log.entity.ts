import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Records idempotent HCM → ReadyOn bulk balance corpus ingest operations.
 */
@Entity({ name: 'corpusIngestLogs' })
export class CorpusIngestLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  idempotencyKey!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

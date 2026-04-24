import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Audit log entries for balance sync operations.
 */
@Entity({ name: 'balanceSyncLogs' })
export class BalanceSyncLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  employeeId!: string;

  @Column({ type: 'float' })
  before!: number;

  @Column({ type: 'float' })
  after!: number;

  @Column({ type: 'varchar', length: 200 })
  reason!: string;

  @Column({ type: 'datetime' })
  timestamp!: Date;
}

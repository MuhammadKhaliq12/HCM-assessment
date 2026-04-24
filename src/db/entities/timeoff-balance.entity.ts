import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Snapshot of an employee's time-off balance by location and type.
 */
@Entity({ name: 'timeOffBalances' })
@Index(['employeeId', 'locationId', 'type'], { unique: true })
export class TimeOffBalanceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  employeeId!: string;

  @Column({ type: 'varchar', length: 50 })
  locationId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: 'float' })
  days!: number;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  hcmVersion!: string | null;
}

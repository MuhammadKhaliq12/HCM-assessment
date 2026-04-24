import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Records submitted time-off requests.
 */
@Entity({ name: 'timeOffRequests' })
export class TimeOffRequestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  employeeId!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  locationId!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'ANNUAL' })
  leaveType!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ type: 'float' })
  days!: number;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @Column({ type: 'datetime' })
  requestedAt!: Date;
}

import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Employee dimensions used by time-off records.
 */
@Entity({ name: 'employees' })
@Index(['employeeId', 'locationId'], { unique: true })
export class EmployeeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  employeeId!: string;

  @Column({ type: 'varchar', length: 50 })
  locationId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;
}

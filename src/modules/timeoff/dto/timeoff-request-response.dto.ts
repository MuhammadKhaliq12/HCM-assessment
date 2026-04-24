import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Output DTO for submitted/listed time-off request records.
 */
export class TimeoffRequestResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'EMP001' })
  employeeId!: string;

  @ApiPropertyOptional({ example: 'USA_HQ' })
  locationId?: string;

  @ApiPropertyOptional({ example: 'ANNUAL' })
  leaveType?: string;

  @ApiProperty({ example: '2026-04-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-04-05' })
  endDate!: string;

  @ApiProperty({ example: 2 })
  days!: number;

  @ApiProperty({ example: 'PENDING_MANAGER', enum: ['PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ example: '2026-04-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-01T12:00:00.000Z' })
  requestedAt!: string;
}

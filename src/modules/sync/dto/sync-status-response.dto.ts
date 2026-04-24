import { ApiProperty } from '@nestjs/swagger';

/**
 * Output DTO for sync health checks.
 */
export class SyncStatusResponseDto {
  @ApiProperty()
  employeeId!: string;

  @ApiProperty({ enum: ['healthy', 'degraded', 'unknown'] })
  status!: 'healthy' | 'degraded' | 'unknown';

  @ApiProperty({ nullable: true })
  lastSyncedAt!: string | null;

  @ApiProperty({ nullable: true })
  lastError!: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Output DTO for employee/location balance endpoint.
 */
export class TimeoffBalanceResponseDto {
  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty({ example: 'ANNUAL' })
  type!: string;

  @ApiProperty({ example: 18.5 })
  days!: number;

  @ApiProperty({ nullable: true })
  lastSyncedAt!: string | null;

  @ApiProperty({ nullable: true })
  hcmVersion!: string | null;

  /** True when the local snapshot has not been refreshed recently. */
  @ApiPropertyOptional()
  staleWarning?: boolean;

  /** Convenience field for UI/tests (equals `days` in this service). */
  @ApiPropertyOptional()
  availableDays?: number;
}

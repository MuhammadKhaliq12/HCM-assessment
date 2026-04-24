import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for POST /timeoff/request payload.
 */
export class CreateTimeoffRequestDto {
  @ApiProperty({ example: 'EMP001' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.1)
  days!: number;

  @ApiProperty({ example: 'USA_HQ' })
  @IsString()
  locationId!: string;

  @ApiPropertyOptional({ example: 'ANNUAL' })
  @IsOptional()
  @IsString()
  leaveType?: string;
}

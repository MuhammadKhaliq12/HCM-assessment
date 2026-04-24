import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/**
 * One row in an HCM → ReadyOn balance corpus payload.
 */
export class BalanceCorpusRowDto {
  @ApiProperty({ example: 'EMP001' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: 'USA_HQ' })
  @IsString()
  locationId!: string;

  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  leaveType!: string;

  @ApiProperty({ example: 17.5 })
  @IsNumber()
  @Min(0)
  days!: number;

  @ApiPropertyOptional({ example: '20260101_120000' })
  @IsOptional()
  @IsString()
  version?: string;
}

/**
 * Bulk ingest body for authoritative balances pushed from HCM.
 */
export class BatchBalanceIngestDto {
  @ApiPropertyOptional({
    description: 'When provided, identical payloads are ignored (idempotent replay).',
    example: 'hcm-export-2026-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({ type: [BalanceCorpusRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceCorpusRowDto)
  balances!: BalanceCorpusRowDto[];
}

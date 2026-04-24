import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional manager rejection context.
 */
export class RejectTimeoffRequestDto {
  @ApiPropertyOptional({ example: 'Team coverage conflict next week.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

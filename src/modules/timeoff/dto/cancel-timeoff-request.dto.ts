import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Employee ownership check when cancelling a pending request.
 */
export class CancelTimeoffRequestDto {
  @ApiProperty({ example: 'EMP001' })
  @IsString()
  employeeId!: string;
}

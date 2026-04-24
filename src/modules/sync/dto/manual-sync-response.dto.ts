import { ApiProperty } from '@nestjs/swagger';

/**
 * Output DTO for manual synchronization trigger.
 */
export class ManualSyncResponseDto {
  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  queued!: boolean;

  @ApiProperty()
  message!: string;
}

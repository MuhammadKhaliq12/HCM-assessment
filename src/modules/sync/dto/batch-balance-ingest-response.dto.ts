import { ApiProperty } from '@nestjs/swagger';

/**
 * Result of a corpus ingest operation.
 */
export class BatchBalanceIngestResponseDto {
  @ApiProperty({ description: 'Number of rows successfully upserted.' })
  applied!: number;

  @ApiProperty({
    description: 'Per-row validation or persistence failures (index matches request array).',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        employeeId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  errors!: Array<{ index: number; employeeId?: string; message: string }>;

  @ApiProperty({ description: 'True when the same idempotency key was already processed.' })
  idempotentReplay!: boolean;

  @ApiProperty({ description: 'Human-readable summary.' })
  message!: string;
}

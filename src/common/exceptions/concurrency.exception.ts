import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when stale data is detected during update/sync operations.
 */
export class ConcurrencyException extends HttpException {
  constructor(message = 'Concurrency conflict detected (stale balance/version).') {
    super(message, HttpStatus.CONFLICT);
  }
}

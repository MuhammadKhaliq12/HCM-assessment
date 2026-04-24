import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when synchronization with HCM fails.
 */
export class HCMSyncException extends HttpException {
  constructor(message = 'Failed to synchronize with HCM system.') {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}

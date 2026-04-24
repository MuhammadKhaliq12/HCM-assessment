import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when an employee does not have enough balance for a request.
 */
export class InsufficientBalanceException extends HttpException {
  constructor(message = 'Insufficient time-off balance.') {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when upstream HCM service is unreachable or times out.
 */
export class TimeoutException extends HttpException {
  constructor(message = 'HCM service timeout or unreachable.') {
    super(message, HttpStatus.GATEWAY_TIMEOUT);
  }
}

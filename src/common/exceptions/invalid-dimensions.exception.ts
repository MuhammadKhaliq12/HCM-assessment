import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when employee/location dimensions are invalid.
 */
export class InvalidDimensionsException extends HttpException {
  constructor(message = 'Provided employee/location dimensions are invalid.') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

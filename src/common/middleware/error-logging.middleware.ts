import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Request middleware that logs failures and preserves consistent observability.
 */
@Injectable()
export class ErrorLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        this.logger.warn(`${req.method} ${req.originalUrl} failed with status ${res.statusCode}`);
      }
    });

    next();
  }
}

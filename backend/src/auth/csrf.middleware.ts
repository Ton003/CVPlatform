import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate a new token if not present
    let token = req.cookies['XSRF-TOKEN'];
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false, // Angular must be able to read this cookie
        sameSite: 'lax',
      });
    }

    // Validate on mutating requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // Ignore /extract and /embed which might be internal or file uploads without CSRF setup
      // Note: Ideally all POST routes are protected, but we exempt public endpoints if needed.
      const headerToken = req.headers['x-xsrf-token'];
      if (!headerToken || headerToken !== token) {
        throw new ForbiddenException('Invalid CSRF Token. Possible Cross-Site Request Forgery detected.');
      }
    }

    next();
  }
}

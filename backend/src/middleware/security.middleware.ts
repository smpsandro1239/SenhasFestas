import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const method = req.method;
    const temCookie = Boolean(req.headers.cookie);
    const temBearer = (req.headers.authorization || '').startsWith('Bearer ');

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && temCookie && !temBearer) {
      const origin = req.headers.origin;
      if (origin) {
        const proto = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('x-forwarded-host') || req.headers.host;
        const mesmaOrigem = origin.replace(/\/+$/, '') === `${proto}://${host}`;
        const permitidas = (process.env.FRONTEND_URL || 'http://localhost:3001')
          .split(',')
          .map((o) => o.trim().replace(/\/+$/, ''));
        if (!mesmaOrigem && !permitidas.includes(origin.replace(/\/+$/, ''))) {
          res.status(HttpStatus.FORBIDDEN).json({
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Origem não permitida',
          });
          return;
        }
      }
    }

    next();
  }
}
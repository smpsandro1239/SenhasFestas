import { Injectable, NestMiddleware, Logger, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const timestamp = new Date().toISOString();

    if (method !== 'GET') {
      const userId = (req as any).user?.id || null;
      const segment = originalUrl.split('/').filter(Boolean);
      const resourceId = segment[segment.length - 1] || null;
      void this.auditLogRepository
        .save(
          this.auditLogRepository.create({
            userId,
            action: method.toLowerCase(),
            resource: originalUrl,
            resourceId,
            ip,
            userAgent,
            details: { method, query: req.query },
          }),
        )
        .catch(() => this.logger.warn('Falha ao registar audit log'));
    }

    res.on('finish', () => {
      const { statusCode } = res;
      if (statusCode >= 400) {
        this.logger.warn(`[${timestamp}] ALERTA: ${method} ${originalUrl} retornou ${statusCode}`);
      }
    });

    next();
  }
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  private readonly windowMs = 60000;

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const requests = this.requests.get(ip) || [];
    const recentRequests = requests.filter(time => now - time < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Muitas requisições. Tente novamente mais tarde.',
      });
      return;
    }

    recentRequests.push(now);
    this.requests.set(ip, recentRequests);

    setTimeout(() => {
      const updated = this.requests.get(ip)?.filter(time => Date.now() - time < this.windowMs);
      if (updated && updated.length > 0) {
        this.requests.set(ip, updated);
      } else {
        this.requests.delete(ip);
      }
    }, this.windowMs);

    next();
  }
}

@Injectable()
export class LoginRateLimitMiddleware implements NestMiddleware {
  private attempts: Map<string, number[] > = new Map();
  private readonly maxAttempts = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10);
  private readonly windowMs = 15 * 60 * 1000;

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const email = (req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase() : '').trim();
    const key = `${ip}:${email}`;
    const now = Date.now();
    const timestamps = (this.attempts.get(key) || []).filter(t => now - t < this.windowMs);

    if (timestamps.length >= this.maxAttempts) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
      });
      return;
    }

    timestamps.push(now);
    this.attempts.set(key, timestamps);

    setTimeout(() => {
      const updated = this.attempts.get(key)?.filter(t => Date.now() - t < this.windowMs);
      if (updated && updated.length > 0) {
        this.attempts.set(key, updated);
      } else {
        this.attempts.delete(key);
      }
    }, this.windowMs);

    next();
  }
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  }
}
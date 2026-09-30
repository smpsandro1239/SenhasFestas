import { Injectable, NestMiddleware, Logger, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../common/redis/redis.service';

const RL_IP_PREFIX = 'rl:ip:';
const RL_LOGIN_PREFIX = 'rl:login:';

function nunca(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((time) => now - time < windowMs);
}

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLogMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const timestamp = new Date().toISOString();

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
  private local: Map<string, number[]> = new Map();
  private readonly maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  private readonly windowMs = 60000;

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';

    if (this.redisService.isEnabled) {
      const key = `${RL_IP_PREFIX}${ip}`;
      try {
        const count = (await this.redisService.incrementWithTtl(key, Math.ceil(this.windowMs / 1000))) ?? 0;
        if (count > this.maxRequests) {
          res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Muitas requisições. Tente novamente mais tarde.',
          });
          return;
        }
        next();
        return;
      } catch (error) {
        // fail-closed: Redis indisponível não abre o limite — cai na contagem local
        Logger.warn(`Falha no rate limit via Redis (contagem local): ${(error as Error).message}`);
      }
    }

    const now = Date.now();
    const recentRequests = nunca(this.local.get(ip) || [], this.windowMs, now);

    if (recentRequests.length >= this.maxRequests) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Muitas requisições. Tente novamente mais tarde.',
      });
      return;
    }

    recentRequests.push(now);
    this.local.set(ip, recentRequests);

    setTimeout(() => {
      const updated = nunca(this.local.get(ip) || [], this.windowMs, Date.now());
      if (updated.length > 0) {
        this.local.set(ip, updated);
      } else {
        this.local.delete(ip);
      }
    }, this.windowMs);

    next();
  }
}

@Injectable()
export class LoginRateLimitMiddleware implements NestMiddleware {
  private local: Map<string, number[]> = new Map();
  private readonly maxAttempts = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10);
  private readonly windowMs = 15 * 60 * 1000;

  constructor(private readonly redisService: RedisService) {}

  private chaveDoPedido(req: Request): string {
    const ip = req.ip || 'unknown';
    const email = (req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase() : '').trim();
    return `${ip}:${email}`;
  }

  private async registarFalhaRedis(chave: string): Promise<void> {
    try {
      const key = `${RL_LOGIN_PREFIX}${chave}`;
      const count = (await this.redisService.incrementWithTtl(key, Math.ceil(this.windowMs / 1000))) ?? 0;
    } catch (error) {
      Logger.warn(`Falha ao registar tentativa de login no Redis: ${(error as Error).message}`);
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const chave = this.chaveDoPedido(req);

    if (this.redisService.isEnabled) {
      let redisOk = false;
      try {
        const atual = await this.redisService.get(`${RL_LOGIN_PREFIX}${chave}`);
        redisOk = true;
        if (atual !== null && parseInt(atual, 10) >= this.maxAttempts) {
          res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
          });
          return;
        }
      } catch (error) {
        // fail-closed: Redis indisponível não abre o limite — cai na contagem local
        Logger.warn(`Falha no rate limit de login via Redis (contagem local): ${(error as Error).message}`);
      }
      if (redisOk) {
        res.on('finish', () => {
          if (res.statusCode !== HttpStatus.UNAUTHORIZED) {
            return;
          }
          void this.registarFalhaRedis(chave);
        });
        next();
        return;
      }
    }

    const now = Date.now();
    const timestamps = nunca(this.local.get(chave) || [], this.windowMs, now);

    if (timestamps.length >= this.maxAttempts) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
      });
      return;
    }

    // Apenas tentativas falhadas contam para o limite (evita bloquear logins bem-sucedidos)
    res.on('finish', () => {
      if (res.statusCode !== HttpStatus.UNAUTHORIZED) {
        return;
      }
      const failed = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
      failed.push(Date.now());
      this.local.set(chave, failed);

      setTimeout(() => {
        const updated = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
        if (updated.length > 0) {
          this.local.set(chave, updated);
        } else {
          this.local.delete(chave);
        }
      }, this.windowMs);
    });

    next();
  }
}
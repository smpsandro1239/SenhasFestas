import { Injectable, NestMiddleware, Logger, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
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
    const { method, path } = req;
    const timestamp = new Date().toISOString();

    res.on('finish', () => {
      const { statusCode } = res;
      if (statusCode >= 400) {
        this.logger.warn(`[${timestamp}] ALERTA: ${method} ${path} retornou ${statusCode}`);
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

  private verificarLimiteLocal(ip: string): boolean {
    const recentes = nunca(this.local.get(ip) || [], this.windowMs, Date.now());
    if (recentes.length > 0) {
      this.local.set(ip, recentes);
    } else {
      this.local.delete(ip);
    }
    return recentes.length >= this.maxRequests;
  }

  private registarPedidoLocal(ip: string): void {
    const recentes = nunca(this.local.get(ip) || [], this.windowMs, Date.now());
    recentes.push(Date.now());
    this.local.set(ip, recentes);

    const timer = setTimeout(() => {
      const atualizadas = nunca(this.local.get(ip) || [], this.windowMs, Date.now());
      if (atualizadas.length > 0) {
        this.local.set(ip, atualizadas);
      } else {
        this.local.delete(ip);
      }
    }, this.windowMs);
    timer.unref?.();
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';

    // Contagens locais feitas durante uma falha Redis mantêm-se activas
    // durante toda a janela, mesmo quando o Redis recupera entretanto.
    if (this.verificarLimiteLocal(ip)) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Muitas requisições. Tente novamente mais tarde.',
      });
      return;
    }

    if (this.redisService.isEnabled) {
      const key = `${RL_IP_PREFIX}${ip}`;
      try {
        const count = await this.redisService.incrementWithTtlStrict(
          key,
          Math.ceil(this.windowMs / 1000),
        );
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
        Logger.warn(`Falha no rate limit via Redis (contagem local): ${(error as Error).message}`);
      }
    }

    this.registarPedidoLocal(ip);
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
    const emailHash = createHash('sha256').update(email).digest('hex');
    return `${ip}:${emailHash}`;
  }

  private verificarLimiteLocal(chave: string): boolean {
    const recentes = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
    if (recentes.length > 0) {
      this.local.set(chave, recentes);
    } else {
      this.local.delete(chave);
    }
    return recentes.length >= this.maxAttempts;
  }

  private registarFalhaLocal(chave: string): void {
    const falhas = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
    falhas.push(Date.now());
    this.local.set(chave, falhas);

    const timer = setTimeout(() => {
      const atualizadas = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
      if (atualizadas.length > 0) {
        this.local.set(chave, atualizadas);
      } else {
        this.local.delete(chave);
      }
    }, this.windowMs);
    timer.unref?.();
  }

  private async registarFalhaRedis(chave: string): Promise<void> {
    try {
      await this.redisService.incrementWithTtlStrict(
        `${RL_LOGIN_PREFIX}${chave}`,
        Math.ceil(this.windowMs / 1000),
      );
    } catch (error) {
      Logger.warn(`Falha ao registar tentativa de login no Redis; a usar contador local: ${(error as Error).message}`);
      this.registarFalhaLocal(chave);
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const chave = this.chaveDoPedido(req);

    // Contagens locais criadas durante uma falha do Redis continuam activas
    // depois da recuperação, evitando uma janela sem protecção na transição.
    if (this.verificarLimiteLocal(chave)) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
      });
      return;
    }

    if (this.redisService.isEnabled) {
      try {
        const atual = await this.redisService.getStrict(`${RL_LOGIN_PREFIX}${chave}`);
        if (atual !== null && parseInt(atual, 10) >= this.maxAttempts) {
          res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
          });
          return;
        }
        res.on('finish', () => {
          if (res.statusCode === HttpStatus.UNAUTHORIZED) {
            void this.registarFalhaRedis(chave);
          }
        });
        next();
        return;
      } catch (error) {
        // Redis indisponível não equivale a chave vazia: usar o limite local.
        Logger.warn(`Falha no rate limit de login via Redis (contagem local): ${(error as Error).message}`);
      }
    }

    // Só tentativas falhadas contam; os logins bem-sucedidos não consomem o limite.
    res.on('finish', () => {
      if (res.statusCode === HttpStatus.UNAUTHORIZED) {
        this.registarFalhaLocal(chave);
      }
    });

    next();
  }
}

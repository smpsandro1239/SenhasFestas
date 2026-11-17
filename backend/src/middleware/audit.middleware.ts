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

  private obterPedidosLocais(ip: string): number[] {
    const recentes = nunca(this.local.get(ip) || [], this.windowMs, Date.now());
    if (recentes.length > 0) this.local.set(ip, recentes);
    else this.local.delete(ip);
    return recentes;
  }

  private reservarPedidoLocal(ip: string): boolean {
    // Reavaliar o contador no momento da reserva: várias chamadas podem ter
    // aguardado Redis em paralelo e chegar aqui com uma leitura inicial obsoleta.
    const recentes = this.obterPedidosLocais(ip);
    if (recentes.length >= this.maxRequests) return false;

    recentes.push(Date.now());
    this.local.set(ip, recentes);
    const timer = setTimeout(() => this.obterPedidosLocais(ip), this.windowMs);
    timer.unref?.();
    return true;
  }

  private responderLimite(res: Response): void {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Muitas requisições. Tente novamente mais tarde.',
    });
  }

  private responderIndisponibilidade(res: Response): void {
    res.setHeader('Retry-After', '30');
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'O serviço está temporariamente indisponível. Tente novamente.',
    });
  }

  private eEndpointDeSaude(path: string): boolean {
    return /^\/api\/health(?:\/(?:ready|live))?\/?$/.test(path);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';

    // Os health checks têm de continuar acessíveis para o orquestrador conseguir
    // distinguir liveness de readiness quando o Redis está indisponível.
    if (this.eEndpointDeSaude(req.path || req.url || '')) {
      next();
      return;
    }

    // Em produção, o rate limit geral também tem de ser partilhado entre réplicas.
    if (process.env.NODE_ENV === 'production' && !this.redisService.isEnabled) {
      this.responderIndisponibilidade(res);
      return;
    }
    const locais = this.obterPedidosLocais(ip);

    if (locais.length >= this.maxRequests) {
      this.responderLimite(res);
      return;
    }

    // Depois de um fallback, a memória continua a ser a fonte única até
    // terminar a janela. Não somar uma nova janela Redis ao orçamento local.
    if (locais.length > 0 || !this.redisService.isEnabled) {
      if (!this.reservarPedidoLocal(ip)) {
        this.responderLimite(res);
        return;
      }
      next();
      return;
    }

    if (this.redisService.isEnabled) {
      try {
        const count = await this.redisService.incrementWithTtlStrict(
          `${RL_IP_PREFIX}${ip}`,
          Math.ceil(this.windowMs / 1000),
        );
        if (count > this.maxRequests) {
          this.responderLimite(res);
          return;
        }
        next();
        return;
      } catch (error) {
        if (process.env.NODE_ENV === 'production') {
          Logger.warn(`Rate limit geral indisponível no Redis (${(error as Error).name || 'erro'}); pedido temporariamente bloqueado.`);
          this.responderIndisponibilidade(res);
          return;
        }
        Logger.warn(`Falha no rate limit via Redis (${(error as Error).name || 'erro'}); a usar contador local fora de produção.`);
      }
    }

    if (!this.reservarPedidoLocal(ip)) {
      this.responderLimite(res);
      return;
    }
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

  private obterFalhasLocais(chave: string): number[] {
    const recentes = nunca(this.local.get(chave) || [], this.windowMs, Date.now());
    if (recentes.length > 0) {
      this.local.set(chave, recentes);
    } else {
      this.local.delete(chave);
    }
    return recentes;
  }

  private reservarFalhaLocal(chave: string): number | null {
    // A reserva local também tem de ser atómica ao nível do event loop.
    // Não reutilizar o tamanho calculado antes de um await ao Redis.
    const falhas = this.obterFalhasLocais(chave);
    if (falhas.length >= this.maxAttempts) return null;

    const timestamp = Date.now();
    falhas.push(timestamp);
    this.local.set(chave, falhas);
    const timer = setTimeout(() => this.obterFalhasLocais(chave), this.windowMs);
    timer.unref?.();
    return timestamp;
  }

  private removerReservaLocal(chave: string, timestamp: number): void {
    const falhas = this.obterFalhasLocais(chave);
    const indice = falhas.indexOf(timestamp);
    if (indice >= 0) falhas.splice(indice, 1);
    if (falhas.length > 0) this.local.set(chave, falhas);
    else this.local.delete(chave);
  }

  private async reservarNoRedis(chave: string): Promise<number> {
    return this.redisService.incrementWithTtlStrict(
      `${RL_LOGIN_PREFIX}${chave}`,
      Math.ceil(this.windowMs / 1000),
    );
  }

  private async libertarReservaRedis(chave: string): Promise<void> {
    await this.redisService.releaseCounterReservationStrict(`${RL_LOGIN_PREFIX}${chave}`);
  }

  private responderLimite(res: Response): void {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Demasiadas tentativas de login. Tente novamente mais tarde.',
    });
  }

  private responderIndisponibilidade(res: Response): void {
    res.setHeader('Retry-After', '30');
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'O serviço de autenticação está temporariamente indisponível. Tente novamente.',
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const chave = this.chaveDoPedido(req);

    // Em produção, o limite de tentativas de login tem de ser partilhado.
    // Um contador em memória por instância não protege contra distribuição
    // de pedidos por várias réplicas/serverless workers.
    if (process.env.NODE_ENV === 'production' && !this.redisService.isEnabled) {
      this.responderIndisponibilidade(res);
      return;
    }

    const locais = this.obterFalhasLocais(chave);

    if (locais.length >= this.maxAttempts) {
      this.responderLimite(res);
      return;
    }

    // Se já houve fallback local nesta janela, manter a mesma fonte de contagem
    // até expirar. Misturar Redis e memória ao recuperar cria orçamento duplo.
    if (locais.length > 0 || !this.redisService.isEnabled) {
      const timestamp = this.reservarFalhaLocal(chave);
      if (timestamp === null) {
        this.responderLimite(res);
        return;
      }
      res.on('finish', () => {
        if (res.statusCode !== HttpStatus.UNAUTHORIZED) {
          this.removerReservaLocal(chave, timestamp);
        }
      });
      next();
      return;
    }

    try {
      const count = await this.reservarNoRedis(chave);
      if (count > this.maxAttempts) {
        // Não libertar a reserva dentro deste try: uma falha no DECR não pode
        // cair no fallback e autorizar precisamente o pedido que foi bloqueado.
        this.responderLimite(res);
        return;
      }

      // A reserva é feita antes de avançar para o controller. Assim, pedidos
      // concorrentes não conseguem todos observar o mesmo contador antigo.
      // Apenas respostas 401 consomem tentativa; respostas bem-sucedidas ou
      // erros de validação libertam a reserva.
      res.on('finish', () => {
        if (res.statusCode !== HttpStatus.UNAUTHORIZED) {
          void this.libertarReservaRedis(chave).catch((error) => {
            Logger.warn(`Falha ao libertar reserva de login no Redis: ${(error as Error).message}`);
          });
        }
      });
      next();
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        // Nunca degradar para um limite por processo em produção: isso permite
        // contornar o brute force distribuindo tentativas por várias instâncias.
        Logger.warn(`Rate limit de login indisponível no Redis (${(error as Error).name || 'erro'}); login temporariamente bloqueado.`);
        this.responderIndisponibilidade(res);
        return;
      }

      Logger.warn(`Falha no rate limit de login via Redis (${(error as Error).name || 'erro'}); a usar contador local fora de produção.`);
      const timestamp = this.reservarFalhaLocal(chave);
      if (timestamp === null) {
        this.responderLimite(res);
        return;
      }
      res.on('finish', () => {
        if (res.statusCode !== HttpStatus.UNAUTHORIZED) {
          this.removerReservaLocal(chave, timestamp);
        }
      });
      next();
    }
  }
}

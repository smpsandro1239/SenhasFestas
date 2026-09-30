import { Injectable, Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      this.logger.warn(`[Redis indisponível] get ignorado: ${key}`);
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Falha no Redis get(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      this.logger.warn(`[Redis indisponível] set ignorado: ${key}`);
      return;
    }
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.warn(`Falha no Redis set(${key}): ${(error as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Falha no Redis del(${key}): ${(error as Error).message}`);
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.warn(`Falha no Redis incr(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    // INCR + EXPIRE numa única operação Lua — atómico por construção. Sem isto,
    // um processo que morra entre os dois comandos deixa a chave sem TTL (rate
    // limit "para sempre"). Nota: a atomicidade é garantida pelo Redis (EVAL não
    // é interleaved); não é testável com mocks — só com Redis real (B1-concorrência).
    const script = `
      local v = redis.call('INCR', KEYS[1])
      if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      return v
    `;
    try {
      return (await this.client.eval(script, 1, key, ttlSeconds)) as number;
    } catch (error) {
      this.logger.warn(`Falha no Redis incrementWithTtl(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.warn(`Falha no Redis expire(${key}): ${(error as Error).message}`);
    }
  }

  async sadd(key: string, member: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.sadd(key, member);
    } catch (error) {
      this.logger.warn(`Falha no Redis sadd(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async srem(key: string, member: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.srem(key, member);
    } catch (error) {
      this.logger.warn(`Falha no Redis srem(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async scard(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.scard(key);
    } catch (error) {
      this.logger.warn(`Falha no Redis scard(${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      this.logger.warn(`Falha no Redis publish(${channel}): ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        this.logger.warn(`Erro ao fechar ligação Redis: ${(error as Error).message}`);
      }
    }
  }
}
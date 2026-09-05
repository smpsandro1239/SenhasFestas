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
import { Controller, Get, HttpStatus, Inject, Logger, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { REDIS_CLIENT } from '../common/redis/redis.service';
import { Redis } from 'ioredis';

type EstadoDependencia = 'healthy' | 'unhealthy' | 'disabled';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      version: '1.0.0',
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const dependencies: { database: EstadoDependencia; redis: EstadoDependencia } = {
      database: (await this.checkDatabase()) ? 'healthy' : 'unhealthy',
      redis: this.checkRedis(),
    };
    // A base de dados é obrigatória; o Redis é opcional (degradação segura quando
    // não configurado), mas se estiver configurado e não estiver pronto a aplicação
    // não pode garantir os fluxos que dependem dele (rate limit, sockets).
    const ready = dependencies.database === 'healthy' && dependencies.redis !== 'unhealthy';
    if (!ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: ready ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  @Get('live')
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Healthcheck de base de dados falhou: ${(error as Error).message}`);
      return false;
    }
  }

  private checkRedis(): EstadoDependencia {
    if (!this.redisClient) {
      return 'disabled';
    }
    return this.redisClient.status === 'ready' ? 'healthy' : 'unhealthy';
  }
}
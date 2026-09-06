import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../common/redis/redis.service';
import { Redis } from 'ioredis';

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
  async ready() {
    const dbStatus = await this.checkDatabase();
    const redisStatus = this.checkRedis();
    const allHealthy = dbStatus && redisStatus;

    return {
      status: allHealthy ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbStatus ? 'healthy' : 'unhealthy',
        redis: redisStatus ? 'healthy' : 'unhealthy',
      },
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

  private checkRedis(): boolean {
    if (!this.redisClient) {
      return false;
    }
    return this.redisClient.status === 'ready';
  }
}
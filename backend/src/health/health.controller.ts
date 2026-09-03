import { Inject } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

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
    // Verificar se a base de dados está disponível
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();
    
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
    // Em produção, faria uma conexão real ao banco
    // Por enquanto, simular sucesso
    return true;
  }

  private async checkRedis(): Promise<boolean> {
    // Em produção, faria um ping ao Redis
    // Por enquanto, simular sucesso
    return true;
  }
}
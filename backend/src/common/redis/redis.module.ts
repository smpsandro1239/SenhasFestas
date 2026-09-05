import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT, RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const url = configService.get<string>('REDIS_URL');
        if (!url) {
          Logger.warn(
            'REDIS_URL não configurado — Redis será desativado em modo de degradação segura.',
            'RedisModule',
          );
          return null;
        }

        const client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          retryStrategy: (times) => {
            if (times > 5) {
              return null;
            }
            return Math.min(times * 500, 2000);
          },
        });

        client.on('error', (error) => {
          Logger.warn(`Erro de ligação ao Redis: ${error.message}`, 'RedisModule');
        });

        client
          .connect()
          .catch((error) => {
            Logger.warn(
              `Não foi possível ligar ao Redis (${error.message}) — a correr em modo degradado.`,
              'RedisModule',
            );
          });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
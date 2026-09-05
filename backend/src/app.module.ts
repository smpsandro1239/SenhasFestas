import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { EventModule } from './modules/event/event.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BalanceModule } from './modules/balance/balance.module';
import { OrderModule } from './modules/order/order.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { PublicScreenModule } from './modules/public-screen/public-screen.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CashClosureModule } from './modules/cash-closure/cash-closure.module';
import { UserModule } from './modules/user/user.module';
import { RedisModule } from './common/redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import {
  AuditMiddleware,
  RateLimitMiddleware,
  SecurityMiddleware,
} from './middleware/audit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: configService.get<string>('NODE_ENV') === 'production',
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),
    RedisModule,
    AuthModule,
    EventModule,
    CatalogModule,
    BalanceModule,
    OrderModule,
    KitchenModule,
    PublicScreenModule,
    ReportsModule,
    CashClosureModule,
    UserModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimitMiddleware, AuditMiddleware)
      .forRoutes('*');
  }
}
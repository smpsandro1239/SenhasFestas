import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { configuracaoBaseDados } from './app.setup';
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
import { MembershipModule } from './common/membership.module';
import { WebSocketModule } from './websocket/websocket.module';
import { DatabaseSeederService } from './seeds/database.seeder';
import { ProductSeederService } from './seeds/product.seeder';
import { UserEntity, CategoryEntity, ProductEntity, AuditLogEntity } from './entities';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import {
  AuditMiddleware,
  RateLimitMiddleware,
  LoginRateLimitMiddleware,
} from './middleware/audit.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';

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
        ...configuracaoBaseDados(configService),
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: configService.get<string>('NODE_ENV') === 'production',
        synchronize: false,
        autoLoadEntities: true,
        logging: false,
      }),
    }),
    RedisModule,
    WebSocketModule,
    MembershipModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([UserEntity, CategoryEntity, ProductEntity, AuditLogEntity]),
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
  providers: [AppService, DatabaseSeederService, ProductSeederService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimitMiddleware, AuditMiddleware)
      .forRoutes('*')
      .apply(LoginRateLimitMiddleware)
      .forRoutes('auth/login');
  }
}
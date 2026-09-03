import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: import('@nestjs/config').ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      }),
      inject: [ConfigModule],
    }),
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
export class AppModule {}
import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventModule } from '../event/event.module';
import { BalanceModule } from '../balance/balance.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EventModule, BalanceModule, AuthModule],
  controllers: [CronController],
})
export class CronModule {}
import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventModule } from '../event/event.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [EventModule, BalanceModule],
  controllers: [CronController],
})
export class CronModule {}
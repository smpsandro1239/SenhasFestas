import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventModule } from '../event/event.module';

@Module({
  imports: [EventModule],
  controllers: [CronController],
})
export class CronModule {}
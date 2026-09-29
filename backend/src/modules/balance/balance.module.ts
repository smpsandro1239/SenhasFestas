import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { EventModule } from '../event/event.module';
import { BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity, EventEntity, EventUserEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity, EventEntity, EventUserEntity]), EventModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
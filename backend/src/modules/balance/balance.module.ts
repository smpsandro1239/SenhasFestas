import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity, EventEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity, EventEntity])],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
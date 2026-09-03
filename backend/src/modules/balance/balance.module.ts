import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity])],
  controllers: [BalanceController],
  providers: [BalanceService, OrderGateway],
  exports: [BalanceService],
})
export class BalanceModule {}
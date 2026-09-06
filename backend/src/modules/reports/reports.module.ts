import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, BalanceEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, BalanceMovementEntity, BalanceEntity])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
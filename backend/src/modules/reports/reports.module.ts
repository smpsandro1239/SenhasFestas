import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, EventUserEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, BalanceMovementEntity, EventUserEntity])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
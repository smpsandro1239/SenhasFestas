import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrderEntity, BalanceMovementEntity, ProductEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, BalanceMovementEntity, ProductEntity])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
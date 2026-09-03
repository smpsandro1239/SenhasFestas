import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderEntity, OrderItemEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
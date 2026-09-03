import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';
import { QRCodeService } from '../../services/qr-code.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity])],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway, QRCodeService],
  exports: [OrderService, QRCodeService],
})
export class OrderModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { EventModule } from '../event/event.module';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity, EventEntity, EventUserEntity } from '../../entities';
import { QRCodeService } from '../../services/qr-code.service';
import { NotificationService } from '../../services/notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity, EventEntity, EventUserEntity]), EventModule],
  controllers: [OrderController],
  providers: [OrderService, QRCodeService, NotificationService],
  exports: [OrderService, QRCodeService, NotificationService],
})
export class OrderModule {}
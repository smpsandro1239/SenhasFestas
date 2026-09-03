import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../entities';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async onModuleInit() {
    console.log('[NotificationService] Inicializado - monitorando mudanças de pedido');
  }

  async notifyOrderStatus(orderId: string, newStatus: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      console.warn(`[NotificationService] Pedido #${orderId} não encontrado`);
      return;
    }

    const message = `Pedido #${order.id.slice(-4)}: ${newStatus}`;
    console.log(`[NotificationService] ${message}`);

    // Em produção: integrar com Push Service, SMS, Email, etc.
    // Exemplo: await this.pushService.send(...);
    // Exemplo: await this.emailService.send(...);
  }

  async notifyNewOrder(orderId: string): Promise<void> {
    await this.notifyOrderStatus(orderId, 'received');
  }

  async notifyOrderPrepared(orderId: string): Promise<void> {
    await this.notifyOrderStatus(orderId, 'preparing');
  }

  async notifyOrderReady(orderId: string): Promise<void> {
    await this.notifyOrderStatus(orderId, 'ready');
  }

  async notifyOrderDelivered(orderId: string): Promise<void> {
    await this.notifyOrderStatus(orderId, 'delivered');
  }
}
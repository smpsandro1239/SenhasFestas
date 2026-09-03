import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity, EventEntity } from '../../entities';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { QRCodeService } from '../../services/qr-code.service';
import { OrderGateway } from '../../websocket/order.gateway';
import { NotificationService } from '../../services/notification.service';
import { MovementType } from '../../entities';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly qrCodeService: QRCodeService,
    private readonly orderGateway: OrderGateway,
    private readonly notificationService: NotificationService,
  ) {}

  async create(user: any, dto: CreateOrderDto): Promise<any> {
    // Create event reference
    const event = await this.eventRepository.findOne({ where: { id: dto.eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const order = this.orderRepository.create({
      source: dto.source,
      event: event,
      status: 'received',
      tableNumber: dto.tableNumber,
      station: dto.station,
      balanceId: dto.balanceId,
      paymentMethod: dto.paymentMethod,
      total: dto.total,
      balanceUsed: dto.balanceUsed || 0,
    });
    const savedOrder = await this.orderRepository.save(order);

    for (const item of dto.items) {
      const product = await this.productRepository.findOne({ where: { id: item.productId } });
      const orderItem = this.orderItemRepository.create({
        order: savedOrder,
        product,
        quantity: item.quantity,
        unitPrice: item.unitPrice || product?.price || 0,
        subtotal: item.quantity * (item.unitPrice || product?.price || 0),
        notes: item.notes,
      });
      await this.orderItemRepository.save(orderItem);
    }

    if (dto.balanceId && dto.balanceUsed) {
      await this.consumeBalance(dto.balanceId, dto.balanceUsed, savedOrder.id);
    }

    // Generate QR code for the order
    const qrCode = await this.qrCodeService.generateOrderQRCode(savedOrder.id);

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status);

    // Send notification for new order
    await this.notificationService.notifyNewOrder(savedOrder.id);

    const result = await this.findOne(savedOrder.id);
    return { ...result, qrCode };
  }

  async consumeBalance(balanceId: string, amount: number, orderId: string): Promise<void> {
    const balance = await this.balanceRepository.findOne({ where: { id: balanceId } });
    if (!balance) {
      throw new NotFoundException('Saldo não encontrado');
    }
    if (balance.currentBalance < amount) {
      throw new ForbiddenException('Saldo insuficiente');
    }

    balance.currentBalance -= amount;
    await this.balanceRepository.save(balance);

    const movement = this.movementRepository.create({
      balance: { id: balanceId } as any,
      type: MovementType.CONSUME,
      amount,
      orderId,
    });
    await this.movementRepository.save(movement);
  }

  async findAll(eventId?: string): Promise<any[]> {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (eventId) {
      query.where('order.event.id = :eventId', { eventId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<any> {
    return this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.id = :id', { id })
      .getOne();
  }

  async cancelOrder(id: string, userId: string): Promise<any> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    order.status = 'cancelled';
    const savedOrder = await this.orderRepository.save(order);
    
    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status);
    
    return savedOrder;
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    order.status = status as 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    const savedOrder = await this.orderRepository.save(order);
    
    // Send notification based on new status
    switch (status) {
      case 'preparing':
        await this.notificationService.notifyOrderPrepared(savedOrder.id);
        break;
      case 'ready':
        await this.notificationService.notifyOrderReady(savedOrder.id);
        break;
      case 'delivered':
        await this.notificationService.notifyOrderDelivered(savedOrder.id);
        break;
      default:
        break;
    }
    
    // Also emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, status);
    
    return savedOrder;
  }
}
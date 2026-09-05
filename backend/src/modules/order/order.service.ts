import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity, EventEntity } from '../../entities';
import { CreateOrderDto } from './dto';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly qrCodeService: QRCodeService,
    private readonly orderGateway: OrderGateway,
    private readonly notificationService: NotificationService,
  ) {}

  async create(user: any, dto: CreateOrderDto): Promise<any> {
    const event = await this.eventRepository.findOne({ where: { id: dto.eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const savedOrder = await this.dataSource.transaction(async (manager) => {
      const order = manager.create(OrderEntity, {
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
      const createdOrder = await manager.save(OrderEntity, order);

      const products = dto.items.length
        ? await manager.findBy(ProductEntity, { id: In(dto.items.map((item) => item.productId)) })
        : [];
      const productById = new Map(products.map((product) => [product.id, product]));

      for (const item of dto.items) {
        const product = productById.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Produto não encontrado: ${item.productId}`);
        }
        const unitPrice = item.unitPrice ?? product.price;
        const orderItem = manager.create(OrderItemEntity, {
          order: createdOrder,
          product,
          quantity: item.quantity,
          unitPrice,
          subtotal: item.quantity * unitPrice,
          notes: item.notes,
        });
        await manager.save(OrderItemEntity, orderItem);
      }

      if (dto.balanceId && dto.balanceUsed) {
        await this.consumeBalanceInTransaction(manager, user, dto.balanceId, dto.balanceUsed, createdOrder.id);
      }

      return createdOrder;
    });

    // Generate QR code for the order
    const qrCode = await this.qrCodeService.generateOrderQRCode(savedOrder.id);

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status);

    // Send notification for new order
    await this.notificationService.notifyNewOrder(savedOrder.id);

    const result = await this.findOne(savedOrder.id);
    return { ...result, qrCode };
  }

  private async consumeBalanceInTransaction(
    manager: import('typeorm').EntityManager,
    user: any,
    balanceId: string,
    amount: number,
    orderId: string,
  ): Promise<void> {
    const balance = await manager.findOne(BalanceEntity, {
      where: { id: balanceId },
      relations: { user: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      throw new NotFoundException('Saldo não encontrado');
    }
    const isClient = user?.role === 'client';
    if (isClient && balance.user?.id !== user.id) {
      throw new ForbiddenException('Não pode usar o saldo de outro utilizador');
    }
    if (balance.currentBalance < amount) {
      throw new ForbiddenException('Saldo insuficiente');
    }

    balance.currentBalance -= amount;
    await manager.save(BalanceEntity, balance);

    const movement = manager.create(BalanceMovementEntity, {
      balance: { id: balanceId } as any,
      type: MovementType.CONSUME,
      amount,
      orderId,
    });
    await manager.save(BalanceMovementEntity, movement);
  }

  async findAll(eventId?: string, balanceIds?: string[]): Promise<any[]> {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (balanceIds && balanceIds.length > 0) {
      query.where('order.balanceId IN (:...balanceIds)', { balanceIds });
    } else if (balanceIds) {
      return [];
    }

    if (eventId) {
      query.andWhere('order.event.id = :eventId', { eventId });
    }

    return query.getMany();
  }

  async findAllForUser(user: any): Promise<any[]> {
    if (user.role === 'client') {
      const balances = await this.balanceRepository.find({
        where: { user: { id: user.id } as any },
      });
      return this.findAll(undefined, balances.map((b) => b.id));
    }
    return this.findAll();
  }

  async findOne(id: string): Promise<any> {
    return this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.id = :id', { id })
      .getOne();
  }

  async cancelOrder(id: string, user: any): Promise<any> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (order.status === 'delivered') {
      throw new ForbiddenException('Pedido entregue não pode ser cancelado');
    }
    if (order.status === 'cancelled') {
      throw new ForbiddenException('Pedido já cancelado');
    }

    const isStaff = user?.role !== 'client';
    if (!isStaff) {
      if (!order.balanceId) {
        throw new ForbiddenException('Não pode cancelar este pedido');
      }
      const balance = await this.balanceRepository.findOne({ where: { id: order.balanceId } });
      if (!balance || balance.user?.id !== user.id) {
        throw new ForbiddenException('Não pode cancelar o pedido de outro utilizador');
      }
    }

    const savedOrder = await this.dataSource.transaction(async (manager) => {
      const currentOrder = await manager.findOne(OrderEntity, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currentOrder) {
        throw new NotFoundException('Pedido não encontrado');
      }
      if (currentOrder.status === 'delivered' || currentOrder.status === 'cancelled') {
        throw new ForbiddenException('Pedido já não pode ser cancelado');
      }

      currentOrder.status = 'cancelled';
      const updatedOrder = await manager.save(OrderEntity, currentOrder);

      if (currentOrder.balanceId && currentOrder.balanceUsed > 0) {
        const balance = await manager.findOne(BalanceEntity, {
          where: { id: currentOrder.balanceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (balance) {
          balance.currentBalance += currentOrder.balanceUsed;
          await manager.save(BalanceEntity, balance);

          const refund = manager.create(BalanceMovementEntity, {
            balance,
            type: MovementType.REFUND,
            amount: currentOrder.balanceUsed,
            orderId: updatedOrder.id,
            description: 'Reembolso por cancelamento',
          });
          await manager.save(BalanceMovementEntity, refund);
        }
      }

      return updatedOrder;
    });

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status);

    return savedOrder;
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const transicoesValidas: Record<string, string[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (!transicoesValidas[order.status]?.includes(status)) {
      throw new ForbiddenException(`Transição inválida: ${order.status} -> ${status}`);
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
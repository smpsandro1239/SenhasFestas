import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity } from '../../entities';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { QRCodeService } from '../qr-code/qr-code.service';
import { OrderGateway } from '../../websocket/order.gateway';

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
    private readonly qrCodeService: QRCodeService,
    private readonly orderGateway: OrderGateway,
  ) {}

  async create(user: any, dto: CreateOrderDto): Promise<any> {
    const order = this.orderRepository.create({
      source: dto.source,
      eventId: dto.eventId,
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
      balance,
      type: 'consume',
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
      query.where('order.eventId = :eventId', { eventId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<any> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    order.status = status;
    return this.orderRepository.save(order);
  }
}

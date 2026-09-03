import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { OrderEntity, BalanceEntity, UserEntity, EventEntity } from '../../entities';

@Injectable()
export class QRCodeService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
  ) {}

  async generateOrderQRCode(orderId: string): Promise<string> {
    const orderUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/qr-order/${orderId}`;
    return QRCode.toDataURL(orderUrl);
  }

  async generateBalanceQRCode(userId: string, eventId: string): Promise<string> {
    const balanceUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/saldo/${userId}?event=${eventId}`;
    return QRCode.toDataURL(balanceUrl);
  }

  async generateTableQRCode(tableNumber: string, eventId: string): Promise<string> {
    const tableUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/qr-order?table=${tableNumber}&event=${eventId}`;
    return QRCode.toDataURL(tableUrl);
  }

  async generateEventQRCode(eventId: string): Promise<string> {
    const eventUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${eventId}`;
    return QRCode.toDataURL(eventUrl);
  }

  async createOrderWithQRCode(orderData: Partial<OrderEntity>): Promise<{ order: OrderEntity; qrCode: string }> {
    const order = this.orderRepository.create(orderData);
    const savedOrder = await this.orderRepository.save(order);
    const qrCode = await this.generateOrderQRCode(savedOrder.id);
    return { order: savedOrder, qrCode };
  }

  async getOrderByQRCode(qrCode: string): Promise<OrderEntity | null> {
    // Em produção, decodificar o QR code para obter o orderId
    // Aqui simulamos a busca por um formato específico
    const orderId = this.extractOrderIdFromQR(qrCode);
    if (orderId) {
      return this.orderRepository.findOne({ where: { id: orderId } });
    }
    return null;
  }

  private extractOrderIdFromQR(qrCode: string): string | null {
    // Simplificado - em produção decodificar o QR code real
    const match = qrCode.match(/orderId=([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  validateQRCodeSignature(qrCode: string): boolean {
    // Implementar validação de assinatura digital do QR code
    // para prevenir fraude
    return true;
  }
}
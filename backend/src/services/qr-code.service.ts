import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QRCodeService {
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
}
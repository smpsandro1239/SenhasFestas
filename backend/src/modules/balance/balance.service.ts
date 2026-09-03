import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceEntity, OrderEntity } from '../../entities';
import { CreateBalanceDto, LoadBalanceDto } from './dto';
import { OrderGateway } from '../../websocket/order.gateway';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly orderGateway: OrderGateway,
  ) {}

  async create(user: any, dto: CreateBalanceDto): Promise<BalanceEntity> {
    const balance = this.balanceRepository.create({
      user: { id: user.id },
      currentBalance: dto.amount,
      createdAt: new Date(),
    });
    const savedBalance = await this.balanceRepository.save(balance);
    this.orderGateway.emitOrderUpdate(savedBalance.id, 'balance_updated');
    return savedBalance;
  }

  async loadBalance(userId: string, dto: LoadBalanceDto): Promise<BalanceEntity> {
    const balance = await this.balanceRepository.findOne({
      where: { id: userId },
    });
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    return balance;
  }

  async consumeBalance(userId: string, amount: number, orderId: string): Promise<{ success: boolean; remaining: number }> {
    const balance = await this.balanceRepository.findOne({ 
      where: { id: userId }
    });
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    if (balance.currentBalance < amount) {
      return { success: false, remaining: balance.currentBalance };
    }

    balance.currentBalance -= amount;
    const newBalance = await this.balanceRepository.save(balance);
    this.orderGateway.emitOrderUpdate(newBalance.id, 'balance_consumed');

    return { success: true, remaining: newBalance.currentBalance };
  }

  async getBalanceHistory(userId: string): Promise<Array<{ id: string; amount: number; timestamp: Date }>> {
    return [];
  }
}
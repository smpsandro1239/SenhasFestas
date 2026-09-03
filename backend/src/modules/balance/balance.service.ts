import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceEntity, OrderEntity } from '../../entities';
import { CreateBalanceDto, LoadBalanceDto } from '../../modules/balance/dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async create(user: any, dto: CreateBalanceDto): Promise<BalanceEntity> {
    const balance = this.balanceRepository.create({
      user: { id: user.id },
      currentBalance: dto.amount,
      createdAt: new Date(),
    });
    return this.balanceRepository.save(balance);
  }

  async loadBalance(userId: string, dto: LoadBalanceDto): Promise<BalanceEntity> {
    const balance = await this.balanceRepository.findOne({
      where: { userId },
    });
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    return balance;
  }

  async consumeBalance(
    userId: string,
    amount: number,
    dto: { productId?: string; reason?: string },
  ): Promise<{ success: boolean; remaining: number }> {
    const balance = await this.loadBalance(userId, dto);
    if (balance.currentBalance < amount) {
      return { success: false, remaining: balance.currentBalance };
    }

    const order = this.orderRepository.create({
      userId,
      total: amount,
      paymentMethod: dto.reason || 'balance',
      createdAt: new Date(),
    });
    await this.orderRepository.save(order);

    const newBalance = this.loadBalance(userId, dto);
    return { success: true, remaining: newBalance.currentBalance };
  }

  async getBalanceHistory(userId: string): Promise<Array<{ id: string; amount: number; timestamp: Date }>> {
    return this.balanceRepository
      .createQueryBuilder('balance')
      .where('user.id = :userId', { userId })
      .orderBy('createdAt', 'asc')
      .getMany();
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity } from '../../entities';
import { CreateBalanceDto, LoadBalanceDto } from './dto';
import { OrderGateway } from '../../websocket/order.gateway';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    private readonly orderGateway: OrderGateway,
  ) {}

  async findByUser(userId: string): Promise<BalanceEntity[]> {
    return this.balanceRepository.find({
      where: { user: { id: userId } as any },
      relations: { event: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(user: any, dto: CreateBalanceDto): Promise<BalanceEntity> {
    const userEntity = await this.userRepository.findOne({ where: { id: user.id } });
    if (!userEntity) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    const balance = this.balanceRepository.create({
      user: userEntity,
      currentBalance: dto.amount,
    });
    const savedBalance = await this.balanceRepository.save(balance);
    
    const movement = this.movementRepository.create({
      balance: savedBalance,
      type: 'load' as any,
      amount: dto.amount,
      description: 'Carregamento inicial',
    });
    await this.movementRepository.save(movement);

    this.orderGateway.emitOrderUpdate(savedBalance.id, 'balance_updated');
    return savedBalance;
  }

  async loadBalance(userId: string, dto: LoadBalanceDto): Promise<BalanceEntity> {
    const balance = await this.balanceRepository.findOne({
      where: { user: { id: userId } as any },
      relations: { user: true },
    });
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    
    balance.currentBalance += dto.amount;
    const savedBalance = await this.balanceRepository.save(balance);

    const movement = this.movementRepository.create({
      balance: savedBalance,
      type: 'load' as any,
      amount: dto.amount,
      description: dto.paymentMethod || 'Carregamento',
    });
    await this.movementRepository.save(movement);

    return savedBalance;
  }

  async consumeBalance(userId: string, amount: number, orderId: string): Promise<{ success: boolean; remaining: number }> {
    const balance = await this.balanceRepository.findOne({ 
      where: { user: { id: userId } as any }
    });
    if (!balance) {
      throw new NotFoundException('Balance not found');
    }
    if (balance.currentBalance < amount) {
      return { success: false, remaining: balance.currentBalance };
    }

    balance.currentBalance -= amount;
    const newBalance = await this.balanceRepository.save(balance);

    const movement = this.movementRepository.create({
      balance: newBalance,
      type: 'consume' as any,
      amount: amount,
      orderId,
      description: 'Consumo em pedido',
    });
    await this.movementRepository.save(movement);

    this.orderGateway.emitOrderUpdate(newBalance.id, 'balance_consumed');
    return { success: true, remaining: newBalance.currentBalance };
  }

  async getBalanceHistory(userId: string): Promise<BalanceMovementEntity[]> {
    const balance = await this.balanceRepository.findOne({
      where: { user: { id: userId } as any }
    });
    if (!balance) {
      return [];
    }
    return this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getBalance(userId: string, eventId?: string): Promise<{ balance: number; movements: BalanceMovementEntity[] }> {
    const balance = await this.balanceRepository.findOne({
      where: eventId ? { user: { id: userId } as any, event: { id: eventId } as any } : { user: { id: userId } as any },
    });
    if (!balance) {
      return { balance: 0, movements: [] };
    }
    const movements = await this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return { balance: balance.currentBalance, movements };
  }
}
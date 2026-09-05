import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalanceEntity, OrderEntity, UserEntity, BalanceMovementEntity, EventEntity, MovementType } from '../../entities';
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
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
      throw new NotFoundException('Utilizador nÃ£o encontrado');
    }

    const event =
      dto.eventId && (await this.eventRepository.findOne({ where: { id: dto.eventId } }));
    if (dto.eventId && !event) {
      throw new NotFoundException('Evento nÃ£o encontrado');
    }

    const savedBalance = await this.dataSource.transaction(async (manager) => {
      const balance = manager.create(BalanceEntity, {
        user: userEntity,
        event: event || undefined,
        currentBalance: dto.amount,
      });
      const created = await manager.save(BalanceEntity, balance);

      const movement = manager.create(BalanceMovementEntity, {
        balance: created,
        type: MovementType.LOAD,
        amount: dto.amount,
        description: 'Carregamento inicial',
      });
      await manager.save(BalanceMovementEntity, movement);
      return created;
    });

    this.orderGateway.emitOrderUpdate(savedBalance.id, 'balance_updated');
    return savedBalance;
  }

  async loadBalance(userId: string, dto: LoadBalanceDto): Promise<BalanceEntity> {
    const savedBalance = await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(BalanceEntity, {
        where: dto.eventId
          ? { user: { id: userId } as any, event: { id: dto.eventId } as any }
          : { user: { id: userId } as any },
        relations: { user: true, event: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Saldo nÃ£o encontrado');
      }

      balance.currentBalance = Number(balance.currentBalance) + dto.amount;
      const updated = await manager.save(BalanceEntity, balance);

      const movement = manager.create(BalanceMovementEntity, {
        balance: updated,
        type: MovementType.LOAD,
        amount: dto.amount,
        description: dto.paymentMethod || 'Carregamento',
      });
      await manager.save(BalanceMovementEntity, movement);

      return updated;
    });

    this.orderGateway.emitOrderUpdate(savedBalance.id, 'balance_updated', savedBalance.event?.id);
    return savedBalance;
  }

  async consumeBalance(userId: string, amount: number, orderId: string): Promise<{ success: boolean; remaining: number }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(BalanceEntity, {
        where: { user: { id: userId } as any },
        relations: { event: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Saldo nÃ£o encontrado');
      }
      const current = Number(balance.currentBalance);
      if (current < amount) {
        return { success: false, remaining: current };
      }

      balance.currentBalance = current - amount;
      const updated = await manager.save(BalanceEntity, balance);

      const movement = manager.create(BalanceMovementEntity, {
        balance: updated,
        type: MovementType.CONSUME,
        amount,
        orderId,
        description: 'Consumo em pedido',
      });
      await manager.save(BalanceMovementEntity, movement);

      this.orderGateway.emitOrderUpdate(updated.id, 'balance_consumed', balance.event?.id);
      return { success: true, remaining: Number(updated.currentBalance) };
    });

    return result;
  }

  async getBalanceHistory(userId: string): Promise<BalanceMovementEntity[]> {
    const balance = await this.balanceRepository.findOne({
      where: { user: { id: userId } as any },
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
      where: eventId
        ? { user: { id: userId } as any, event: { id: eventId } as any }
        : { user: { id: userId } as any },
    });
    if (!balance) {
      return { balance: 0, movements: [] };
    }
    const movements = await this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return { balance: Number(balance.currentBalance), movements };
  }
}
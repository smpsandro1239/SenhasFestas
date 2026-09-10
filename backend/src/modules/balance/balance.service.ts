import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalanceEntity, UserEntity, BalanceMovementEntity, EventEntity, EventUserEntity, MovementType } from '../../entities';
import { LoadBalanceDto } from './dto';
import { OrderGateway } from '../../websocket/order.gateway';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly orderGateway: OrderGateway,
  ) {}

  async assertMemberEvent(userId: string, eventId: string): Promise<void> {
    const membership = await this.eventUserRepository.findOne({
      where: { user: { id: userId }, event: { id: eventId } },
    });
    if (!membership) {
      throw new ForbiddenException('Não pertence a este evento');
    }
  }

  async findBalance(userId: string, eventId?: string): Promise<BalanceEntity | null> {
    return this.balanceRepository.findOne({
      where: eventId
        ? ({ user: { id: userId }, event: { id: eventId } } as any)
        : ({ user: { id: userId } } as any),
    });
  }

  async loadBalance(userId: string, dto: LoadBalanceDto): Promise<BalanceEntity> {
    const updated = await this.runLoadTransaction(userId, dto);
    this.orderGateway.emitOrderUpdate(updated.id, 'balance_updated', updated.event?.id);
    return updated;
  }

  private async runLoadTransaction(
    userId: string,
    dto: LoadBalanceDto,
    tries = 3,
  ): Promise<BalanceEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        let balance = await manager.findOne(BalanceEntity, {
          where: dto.eventId
            ? ({ user: { id: userId }, event: { id: dto.eventId } } as any)
            : ({ user: { id: userId } } as any),
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          const userEntity = await manager.findOne(UserEntity, { where: { id: userId } });
          if (!userEntity) {
            throw new NotFoundException('Utilizador não encontrado');
          }

          let event: EventEntity | undefined;
          if (dto.eventId) {
            event = await manager.findOne(EventEntity, { where: { id: dto.eventId } });
            if (!event) {
              throw new NotFoundException('Evento não encontrado');
            }
          }

          balance = manager.create(BalanceEntity, {
            user: userEntity,
            event: event || undefined,
            currentBalance: 0,
          });
          await manager.save(BalanceEntity, balance);
        }

        balance.currentBalance = Number(balance.currentBalance) + dto.amount;
        const saved = await manager.save(BalanceEntity, balance);

        const movement = manager.create(BalanceMovementEntity, {
          balance: saved,
          type: MovementType.LOAD,
          amount: dto.amount,
          description: dto.paymentMethod || 'Carregamento',
        });
        await manager.save(BalanceMovementEntity, movement);

        return saved;
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (tries > 1 && code === '23505') {
        return this.runLoadTransaction(userId, dto, tries - 1);
      }
      throw error;
    }
  }

  async getBalanceHistory(
    userId: string,
    eventId?: string,
  ): Promise<BalanceMovementEntity[]> {
    const balance = await this.findBalance(userId, eventId);
    if (!balance) {
      return [];
    }
    return this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getBalance(
    userId: string,
    eventId?: string,
  ): Promise<{ id: string | null; balance: number; movements: BalanceMovementEntity[] }> {
    const balance = await this.findBalance(userId, eventId);
    if (!balance) {
      return { id: null, balance: 0, movements: [] };
    }
    const movements = await this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return { id: balance.id, balance: Number(balance.currentBalance), movements };
  }
}
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
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

  async loadBalance(userId: string, dto: LoadBalanceDto, actor?: any): Promise<Partial<BalanceEntity>> {
    const updated = await this.runLoadTransaction(userId, dto, actor);
    this.orderGateway.emitOrderUpdate(updated.id, 'balance_updated', updated.event?.id);
    const { password: _password, ...safeUser } = (updated as any).user ?? {};
    return {
      id: updated.id,
      currentBalance: updated.currentBalance,
      event: updated.event,
      user: safeUser,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async reverseLoad(
    userId: string,
    movementId: string,
    actor?: any,
  ): Promise<{
    balance: { id: string; currentBalance: number };
    movement: BalanceMovementEntity;
    reversedMovementId: string;
  }> {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const movement = await manager.findOne(BalanceMovementEntity, {
        where: { id: movementId },
        relations: { balance: { user: true } as any },
        lock: { mode: 'pessimistic_write' },
      });
      if (!movement) {
        throw new NotFoundException('Movimento não encontrado');
      }
      const donoId = (movement.balance as any)?.user?.id;
      if (donoId !== userId) {
        throw new ForbiddenException('Movimento não pertence a este utilizador');
      }
      if (movement.type !== MovementType.LOAD) {
        throw new ForbiddenException('Apenas carregamentos podem ser estornados');
      }
      if (movement.reversed) {
        throw new ConflictException('Carregamento já estornado');
      }

      const balance = await manager.findOne(BalanceEntity, {
        where: { id: movement.balance.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Saldo não encontrado');
      }
      const montante = Number(movement.amount);
      if (Number(balance.currentBalance) < montante) {
        throw new ForbiddenException('Saldo insuficiente para estornar (já utilizado)');
      }

      movement.reversed = true;
      movement.reversedAt = new Date();
      await manager.save(BalanceMovementEntity, movement);

      balance.currentBalance = Number(balance.currentBalance) - montante;
      const savedBalance = await manager.save(BalanceEntity, balance);

      const reversal = manager.create(BalanceMovementEntity, {
        balance: { id: balance.id } as any,
        type: MovementType.CANCEL,
        amount: montante,
        description: 'Estorno de carregamento',
        reversedOfId: movement.id,
        createdById: actor?.id,
      });
      const savedReversal = await manager.save(BalanceMovementEntity, reversal);

      return {
        balance: { id: savedBalance.id, currentBalance: Number(savedBalance.currentBalance) },
        movement: savedReversal,
        reversedMovementId: movement.id,
      };
    });

    this.orderGateway.emitOrderUpdate(resultado.balance.id, 'balance_updated', undefined);
    return resultado;
  }

  private async runLoadTransaction(
    userId: string,
    dto: LoadBalanceDto,
    actor?: any,
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
          createdById: actor?.id,
        });
        await manager.save(BalanceMovementEntity, movement);

        return saved;
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (tries > 1 && code === '23505') {
        return this.runLoadTransaction(userId, dto, actor, tries - 1);
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
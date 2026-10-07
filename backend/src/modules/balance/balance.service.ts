import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, IsNull, LessThan } from 'typeorm';
import { BalanceEntity, UserEntity, BalanceMovementEntity, EventEntity, EventUserEntity, MovementType } from '../../entities';
import { LoadBalanceDto, DeductBalanceDto, ReverseLoadDto, ExtendBalanceDto } from './dto';
import { toPublicUser } from '../../common/serializers';
import { centavos, soma, subtrai } from '../../common/money';
import { assertSaldoUtilizavel, saldoDeadlineUtc } from '../../common/balance-guard';
import { EventService } from '../event/event.service';

const DIA_MS = 86_400_000;
const SOFT_DELETE_APOS_DIAS = 30;

export interface SaldoEstado {
  userId: string;
  eventId?: string;
  archivedAt: Date | null;
  extendedUntil: Date | null;
  notifiedAt: Date | null;
  deadline: string | null;
}

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
    private readonly eventService: EventService,
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
      relations: { event: true },
    });
  }

  async loadBalance(userId: string, dto: LoadBalanceDto, actor?: any): Promise<Partial<BalanceEntity>> {
    if (!dto.eventId) {
      throw new ForbiddenException('Carregamento de saldo exige eventId (evita saldo sem scope de evento)');
    }
    await this.eventService.assertEventOperavelById(dto.eventId);
    const updated = await this.runLoadTransaction(userId, dto, actor);
    return {
      id: updated.id,
      currentBalance: updated.currentBalance,
      event: updated.event,
      user: toPublicUser((updated as any).user) as any,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async reverseLoad(
    userId: string,
    movementId: string,
    actor?: any,
    dto?: ReverseLoadDto,
  ): Promise<{
    balance: { id: string; currentBalance: number };
    movement: BalanceMovementEntity;
    reversedMovementId: string;
    eventId?: string;
  }> {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const movement = await manager.findOne(BalanceMovementEntity, {
        where: { id: movementId },
        relations: { balance: { user: true, event: true } as any },
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

      // Autorização scoped pelo evento REAL do movimento (não pelo eventId da query)
      if (actor && actor.role !== 'superadmin') {
        const eventoMovimento = (movement.balance as any)?.event?.id as string | undefined;
        if (!eventoMovimento) {
          throw new ForbiddenException('Movimento sem evento associado');
        }
        const membro = await manager.findOne(EventUserEntity, {
          where: { user: { id: actor.id }, event: { id: eventoMovimento } },
        });
        if (!membro) {
          throw new ForbiddenException('Não pertence a este evento');
        }
      }

      const locked = await manager.findOne(BalanceMovementEntity, {
        where: { id: movementId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Movimento não encontrado');
      }
      if (locked.reversed) {
        throw new ConflictException('Carregamento já estornado');
      }

      const balance = await manager.findOne(BalanceEntity, {
        where: { id: movement.balance.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Saldo não encontrado');
      }

      // Estorno pode ser parcial: o valor estornado nunca excede o disponível
      // (saldo atual) nem o montante original do carregamento.
      const montanteOriginal = centavos(Number(locked.amount));
      const saldoAtual = centavos(Number(balance.currentBalance));
      const estorno = dto?.amount !== undefined ? centavos(Number(dto.amount)) : montanteOriginal;
      const disponivel = Math.min(saldoAtual, montanteOriginal);
      if (estorno <= 0) {
        throw new ForbiddenException('Valor a estornar inválido');
      }
      if (estorno > disponivel + 0.005) {
        throw new ForbiddenException('Saldo insuficiente para estornar (já utilizado)');
      }

      locked.reversed = true;
      locked.reversedAt = new Date();
      await manager.save(BalanceMovementEntity, locked);

      balance.currentBalance = subtrai(Number(balance.currentBalance), estorno);
      const savedBalance = await manager.save(BalanceEntity, balance);

      const reversal = manager.create(BalanceMovementEntity, {
        balance: { id: balance.id } as any,
        type: MovementType.CANCEL,
        amount: estorno,
        description: estorno >= montanteOriginal - 0.005 ? 'Estorno de carregamento' : 'Estorno parcial de carregamento',
        reversedOfId: locked.id,
        createdById: actor?.id,
      });
      const savedReversal = await manager.save(BalanceMovementEntity, reversal);

      return {
        balance: { id: savedBalance.id, currentBalance: Number(savedBalance.currentBalance) },
        movement: savedReversal,
        reversedMovementId: locked.id,
        eventId: (movement.balance as any)?.event?.id as string | undefined,
      };
    });

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
        let event: EventEntity | undefined;
        if (dto.eventId) {
          event = await manager.findOne(EventEntity, { where: { id: dto.eventId } }) ?? undefined;
        }

        let balance = await manager.findOne(BalanceEntity, {
          where: dto.eventId
            ? ({ user: { id: userId }, event: { id: dto.eventId } } as any)
            : ({ user: { id: userId } } as any),
          lock: { mode: 'pessimistic_write' },
        });

        if (balance) {
          // Arquivado não aceita novos carregamentos (senão o dinheiro fica preso
          // até um estorno manual).
          assertSaldoUtilizavel({
            archivedAt: balance.archivedAt,
            extendedUntil: balance.extendedUntil,
            event,
          });
        }

        if (!balance) {
          const userEntity = await manager.findOne(UserEntity, { where: { id: userId } });
          if (!userEntity) {
            throw new NotFoundException('Utilizador não encontrado');
          }

          if (dto.eventId && !event) {
            throw new NotFoundException('Evento não encontrado');
          }

          balance = manager.create(BalanceEntity, {
            user: userEntity,
            event: event || undefined,
            currentBalance: 0,
          });
          await manager.save(BalanceEntity, balance);
        }

        balance.currentBalance = soma(Number(balance.currentBalance), centavos(dto.amount));
        const saved = await manager.save(BalanceEntity, balance);

        const movement = manager.create(BalanceMovementEntity, {
          balance: saved,
          type: MovementType.LOAD,
          amount: centavos(dto.amount),
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

  async deductBalance(
    userId: string,
    dto: DeductBalanceDto,
    actor?: any,
  ): Promise<{ id: string; currentBalance: number; movement: BalanceMovementEntity }> {
    if (!dto.eventId) {
      throw new ForbiddenException('Desconto de saldo exige eventId (evita saldo sem scope de evento)');
    }
    await this.eventService.assertEventOperavelById(dto.eventId);
    const resultado = await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(BalanceEntity, {
        where: dto.eventId
          ? ({ user: { id: userId }, event: { id: dto.eventId } } as any)
          : ({ user: { id: userId } } as any),
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Saldo não encontrado para este cliente/evento');
      }

      const evento = await manager.findOne(EventEntity, { where: { id: dto.eventId } });
      assertSaldoUtilizavel({
        archivedAt: balance.archivedAt,
        extendedUntil: balance.extendedUntil,
        event: evento,
      });

      const montante = centavos(Number(dto.amount));
      if (montante <= 0) {
        throw new ForbiddenException('Valor de desconto inválido');
      }
      if (centavos(Number(balance.currentBalance)) < montante) {
        throw new ForbiddenException('Saldo insuficiente para descontar');
      }

      balance.currentBalance = subtrai(Number(balance.currentBalance), montante);
      const savedBalance = await manager.save(BalanceEntity, balance);

      const movement = manager.create(BalanceMovementEntity, {
        balance: savedBalance,
        type: MovementType.CONSUME,
        amount: montante,
        description: dto.description || 'Desconto de saldo (caixa)',
        createdById: actor?.id,
      });
      const savedMovement = await manager.save(BalanceMovementEntity, movement);

      return {
        id: savedBalance.id,
        currentBalance: Number(savedBalance.currentBalance),
        movement: savedMovement,
      };
    });

    return resultado;
  }

  /**
   * Arquivamento automático (cron + lazy):
   * - saldos com saldo > 0 cujo prazo venceu e ainda não arquivados → archivedAt;
   * - saldos arquivados há 30+ dias → soft-delete (deletedAt), reversível.
   */
  async archiveExpiredBalances(
    now: Date = new Date(),
  ): Promise<{ arquivados: number; removidos: number }> {
    const softDeleteLimite = new Date(now.getTime() - SOFT_DELETE_APOS_DIAS * DIA_MS);
    const candidatos = await this.balanceRepository.find({
      where: [
        { archivedAt: IsNull(), currentBalance: MoreThan(0) as any },
        { archivedAt: LessThan(softDeleteLimite) },
      ],
      relations: { event: true },
    });

    let arquivados = 0;
    let removidos = 0;
    for (const saldo of candidatos) {
      if (!saldo.archivedAt) {
        const deadline = saldoDeadlineUtc(saldo.event, saldo.extendedUntil);
        if (deadline && now.getTime() > deadline.getTime()) {
          saldo.archivedAt = now;
          await this.balanceRepository.save(saldo);
          arquivados += 1;
        }
        continue;
      }
      saldo.deletedAt = now;
      await this.balanceRepository.save(saldo);
      removidos += 1;
    }

    return { arquivados, removidos };
  }

  private async carregarSaldoEvento(userId: string, eventId: string): Promise<BalanceEntity> {
    const balance = await this.balanceRepository.findOne({
      where: { user: { id: userId }, event: { id: eventId } } as any,
      relations: { event: true, user: true },
    });
    if (!balance) {
      throw new NotFoundException('Saldo não encontrado');
    }
    return balance;
  }

  private resumoSaldo(userId: string, balance: BalanceEntity) {
    const deadline = saldoDeadlineUtc(balance.event, balance.extendedUntil);
    return {
      userId,
      eventId: balance.event?.id,
      archivedAt: balance.archivedAt ?? null,
      extendedUntil: balance.extendedUntil ?? null,
      notifiedAt: balance.notifiedAt ?? null,
      deadline: deadline ? deadline.toISOString() : null,
    };
  }

  async extendBalance(
    userId: string,
    dto: ExtendBalanceDto,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, dto.eventId);
    const until = new Date(dto.until);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new BadRequestException('Data de extensão tem de ser futura');
    }
    balance.extendedUntil = until;
    if (balance.archivedAt) {
      // Extensão para o futuro revive um saldo já arquivado.
      balance.archivedAt = null;
    }
    const saved = await this.balanceRepository.save(balance);
    return this.resumoSaldo(userId, saved);
  }

  async unarchiveBalance(
    userId: string,
    eventId: string,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, eventId);
    balance.archivedAt = null;
    const saved = await this.balanceRepository.save(balance);
    return this.resumoSaldo(userId, saved);
  }

  async markNotified(
    userId: string,
    eventId: string,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, eventId);
    balance.notifiedAt = new Date();
    const saved = await this.balanceRepository.save(balance);
    return this.resumoSaldo(userId, saved);
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

  async listSaldosPendentes(
    eventId: string,
    utilizador: any,
  ): Promise<{ userId: string; name: string; email?: string; balance: number }[]> {
    const evento = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado');
    }
    if (utilizador.role !== 'superadmin') {
      await this.assertMemberEvent(utilizador.id, eventId);
    }
    const saldos = await this.balanceRepository.find({
      where: { event: { id: eventId }, currentBalance: MoreThan(0) as any },
      relations: { user: true },
      order: { currentBalance: 'DESC' },
    });
    return saldos.map((saldo) => ({
      userId: saldo.user?.id,
      name: saldo.user?.name ?? 'Cliente',
      email: saldo.user?.email,
      balance: Number(saldo.currentBalance),
    }));
  }

  async getBalance(
    userId: string,
    eventId?: string,
  ): Promise<{
    id: string | null;
    balance: number;
    movements: BalanceMovementEntity[];
    deadline: string | null;
    archivedAt: Date | null;
  }> {
    const balance = await this.findBalance(userId, eventId);
    if (!balance) {
      return { id: null, balance: 0, movements: [], deadline: null, archivedAt: null };
    }
    const movements = await this.movementRepository.find({
      where: { balance: { id: balance.id } as any },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const deadline = saldoDeadlineUtc(balance.event, balance.extendedUntil);
    return {
      id: balance.id,
      balance: Number(balance.currentBalance),
      movements,
      deadline: deadline ? deadline.toISOString() : null,
      archivedAt: balance.archivedAt ?? null,
    };
  }
}
import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, IsNull, LessThan } from 'typeorm';
import { BalanceEntity, UserEntity, BalanceMovementEntity, EventEntity, EventUserEntity, MovementType } from '../../entities';
import { LoadBalanceDto, DeductBalanceDto, ReverseLoadDto, ExtendBalanceDto, TransferBalanceDto } from './dto';
import { toPublicUser } from '../../common/serializers';
import { centavos, soma, subtrai } from '../../common/money';
import { assertSaldoUtilizavel, saldoDeadlineUtc } from '../../common/balance-guard';
import { EventService } from '../event/event.service';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

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

  private validarChaveIdempotencia(value: string | undefined, actor?: any): string | undefined {
    if (value === undefined) return undefined;
    const key = value.trim();
    if (!actor?.id) {
      throw new BadRequestException('Idempotency-Key requer um utilizador autenticado');
    }
    if (key.length < 8 || key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) {
      throw new BadRequestException('Idempotency-Key inválida (8 a 128 caracteres ASCII visíveis)');
    }
    return key;
  }

  private hashOperacaoFinanceira(
    operation: 'load' | 'deduct' | 'reverse' | 'transfer',
    actorId: string,
    userId: string,
    eventId: string,
    details: Record<string, unknown>,
  ): string {
    return createHash('sha256')
      .update(JSON.stringify({ operation, actorId, userId, eventId, ...details }))
      .digest('hex');
  }

  private hashChaveIdempotencia(operation: 'reverse' | 'transfer', key: string): string {
    return createHash('sha256').update(`senhasfestas:${operation}:${key}`).digest('hex');
  }

  private async lockOperationKey(
    manager: import('typeorm').EntityManager,
    actorId: string,
    operation: 'load' | 'deduct' | 'reverse' | 'transfer',
    idempotencyKey: string,
  ): Promise<void> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [`${actorId}:${operation}`, idempotencyKey],
    );
  }

  private assertHashOperacao(
    movement: BalanceMovementEntity,
    requestHash: string,
  ): void {
    if (!movement.requestHash || movement.requestHash !== requestHash) {
      throw new ConflictException('Idempotency-Key já utilizada com outro conteúdo');
    }
  }

  private async assertMemberEventInTransaction(
    manager: import('typeorm').EntityManager,
    userId: string,
    eventId: string,
  ): Promise<void> {
    const membership = await manager.findOne(EventUserEntity, {
      where: { user: { id: userId }, event: { id: eventId } },
      // FOR SHARE impede remoção/alteração da membership até a operação financeira concluir.
      lock: { mode: 'pessimistic_read' },
    });
    if (!membership) {
      throw new ForbiddenException('Não pertence a este evento');
    }
  }

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

  async loadBalance(
    userId: string,
    dto: LoadBalanceDto,
    actor?: any,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
    rawIdempotencyKey?: string,
  ): Promise<Partial<BalanceEntity>> {
    if (!dto.eventId) {
      throw new ForbiddenException('Carregamento de saldo exige eventId (evita saldo sem scope de evento)');
    }
    const idempotencyKey = this.validarChaveIdempotencia(rawIdempotencyKey, actor);
    const requestHash = idempotencyKey
      ? this.hashOperacaoFinanceira('load', actor.id, userId, dto.eventId, {
          amount: centavos(dto.amount),
          paymentMethod: dto.paymentMethod ?? 'Carregamento',
        })
      : undefined;
    if (!idempotencyKey) {
      await this.eventService.assertEventOperavelById(dto.eventId);
    }
    const updated = await this.runLoadTransaction(
      userId, dto, actor, arquivar, idempotencyKey, requestHash,
    );
    await this.eventService.vincularCliente(userId, dto.eventId);
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
    arquivar?: (snapshot: SnapshotAuditoria) => void,
    rawIdempotencyKey?: string,
  ): Promise<{
    balance: { id: string; currentBalance: number };
    movement: BalanceMovementEntity;
    reversedMovementId: string;
    eventId?: string;
  }> {
    const idempotencyKey = this.validarChaveIdempotencia(rawIdempotencyKey, actor);
    const storedIdempotencyKey = idempotencyKey
      ? this.hashChaveIdempotencia('reverse', idempotencyKey)
      : undefined;
    const requestHash = idempotencyKey
      ? this.hashOperacaoFinanceira('reverse', actor.id, userId, movementId, {
          amount: dto?.amount === undefined ? null : centavos(dto.amount),
        })
      : undefined;

    const resultado = await this.dataSource.transaction(async (manager) => {
      const movement = await manager.findOne(BalanceMovementEntity, {
        where: { id: movementId },
        relations: { balance: { user: true, event: true } as any },
        withDeleted: true,
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

      // Serializar retries antes de adquirir o lock de autorização.
      if (idempotencyKey && storedIdempotencyKey) {
        await this.lockOperationKey(manager, actor.id, 'reverse', idempotencyKey);
      }

      // Autorização scoped pelo evento REAL do movimento (não pelo eventId da query).
      if (actor && actor.role !== 'superadmin') {
        const eventoMovimento = (movement.balance as any)?.event?.id as string | undefined;
        if (!eventoMovimento) {
          throw new ForbiddenException('Movimento sem evento associado');
        }
        const membro = await manager.findOne(EventUserEntity, {
          where: { user: { id: actor.id }, event: { id: eventoMovimento } },
          lock: { mode: 'pessimistic_read' },
        });
        if (!membro) {
          throw new ForbiddenException('Não pertence a este evento');
        }
      }

      if (idempotencyKey && storedIdempotencyKey) {
        const anterior = await manager.findOne(BalanceMovementEntity, {
          where: {
            createdById: actor.id,
            type: MovementType.CANCEL,
            idempotencyKey: storedIdempotencyKey,
          },
          relations: { balance: true },
          withDeleted: true,
        });
        if (anterior) {
          this.assertHashOperacao(anterior, requestHash!);
          if (!anterior.balance) {
            throw new NotFoundException('Saldo do estorno não encontrado');
          }
          const saldoAnterior = await manager.findOne(BalanceEntity, {
            where: { id: anterior.balance.id },
            withDeleted: true,
          });
          if (!saldoAnterior) {
            throw new NotFoundException('Saldo do estorno não encontrado');
          }
          return {
            balance: {
              id: saldoAnterior.id,
              currentBalance: Number(saldoAnterior.currentBalance),
            },
            movement: anterior,
            reversedMovementId: movementId,
            eventId: (movement.balance as any)?.event?.id as string | undefined,
          };
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

      const montanteOriginal = centavos(Number(locked.amount));
      const jaEstornado = centavos(Number(locked.reversedAmount ?? 0));
      const restante = centavos(Math.max(0, montanteOriginal - jaEstornado));
      if (restante <= 0) {
        throw new ConflictException('Carregamento já estornado');
      }

      const balance = await manager.findOne(BalanceEntity, {
        where: { id: movement.balance.id },
        lock: { mode: 'pessimistic_write' },
        withDeleted: true,
      });
      if (!balance) {
        throw new NotFoundException('Saldo não encontrado');
      }

      // Estornos parciais acumulam no movimento original. O default estorna
      // apenas o remanescente, nunca o montante original uma segunda vez.
      const saldoAtual = centavos(Number(balance.currentBalance));
      const estorno = dto?.amount !== undefined ? centavos(Number(dto.amount)) : restante;
      const disponivel = Math.min(saldoAtual, restante);
      if (estorno <= 0) {
        throw new ForbiddenException('Valor a estornar inválido');
      }
      if (estorno > disponivel + 0.005) {
        throw new ForbiddenException('Valor a estornar excede o remanescente disponível');
      }

      arquivar?.({
        antes: { currentBalance: saldoAtual },
        eventId: (movement.balance as any)?.event?.id as string | undefined,
      });

      locked.reversedAmount = centavos(jaEstornado + estorno);
      locked.reversed = locked.reversedAmount >= montanteOriginal - 0.005;
      locked.reversedAt = locked.reversed ? new Date() : undefined;
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
        idempotencyKey: storedIdempotencyKey,
        requestHash,
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
    arquivar?: (snapshot: SnapshotAuditoria) => void,
    idempotencyKey?: string,
    requestHash?: string,
    tries = 3,
  ): Promise<BalanceEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        let event: EventEntity | undefined;
        if (dto.eventId) {
          event = await manager.findOne(EventEntity, { where: { id: dto.eventId } }) ?? undefined;
        }

        if (idempotencyKey) {
          // Primeiro serializar retries; só depois bloquear a membership e os saldos.
          await this.lockOperationKey(manager, actor.id, 'load', idempotencyKey);
          if (actor && actor.role !== 'superadmin') {
            await this.assertMemberEventInTransaction(manager, actor.id, dto.eventId);
          }
          const anterior = await manager.findOne(BalanceMovementEntity, {
            where: { createdById: actor.id, idempotencyKey, type: MovementType.LOAD },
            relations: { balance: { event: true, user: true } },
            withDeleted: true,
          });
          if (anterior) {
            this.assertHashOperacao(anterior, requestHash!);
            if (!anterior.balance) throw new NotFoundException('Saldo do carregamento não encontrado');
            return anterior.balance;
          }
          await this.eventService.assertEventOperavelById(dto.eventId);
        } else if (actor && actor.role !== 'superadmin') {
          await this.assertMemberEventInTransaction(manager, actor.id, dto.eventId);
        }

        let balance = await manager.findOne(BalanceEntity, {
          where: dto.eventId
            ? ({ user: { id: userId }, event: { id: dto.eventId } } as any)
            : ({ user: { id: userId } } as any),
          lock: { mode: 'pessimistic_write' },
          withDeleted: true,
        });

        if (balance) {
          // Um registo soft-deleted continua a ocupar a chave única user/event.
          // Carregá-lo aqui evita tentar criar um duplicado; só a extensão ou o
          // desarquivamento explícito o pode reactivar.
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

        arquivar?.({ antes: { currentBalance: centavos(Number(balance.currentBalance)) }, eventId: dto.eventId });

        balance.currentBalance = soma(Number(balance.currentBalance), centavos(dto.amount));
        const saved = await manager.save(BalanceEntity, balance);

        const movement = manager.create(BalanceMovementEntity, {
          balance: saved,
          type: MovementType.LOAD,
          amount: centavos(dto.amount),
          description: dto.paymentMethod || 'Carregamento',
          createdById: actor?.id,
          idempotencyKey,
          requestHash,
        });
        await manager.save(BalanceMovementEntity, movement);

        return saved;
      });
    } catch (error) {
      const wrapped = error as { code?: string; driverError?: { code?: string } } | null;
      const code = wrapped?.driverError?.code ?? wrapped?.code;
      if (tries > 1 && code === '23505') {
        return this.runLoadTransaction(
          userId, dto, actor, arquivar, idempotencyKey, requestHash, tries - 1,
        );
      }
      throw error;
    }
  }

  async deductBalance(
    userId: string,
    dto: DeductBalanceDto,
    actor?: any,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
    rawIdempotencyKey?: string,
  ): Promise<{ id: string; currentBalance: number; movement: BalanceMovementEntity }> {
    if (!dto.eventId) {
      throw new ForbiddenException('Desconto de saldo exige eventId (evita saldo sem scope de evento)');
    }
    const idempotencyKey = this.validarChaveIdempotencia(rawIdempotencyKey, actor);
    const requestHash = idempotencyKey
      ? this.hashOperacaoFinanceira('deduct', actor.id, userId, dto.eventId, {
          amount: centavos(dto.amount),
          description: dto.description ?? 'Desconto de saldo (caixa)',
        })
      : undefined;
    if (!idempotencyKey) {
      await this.eventService.assertEventOperavelById(dto.eventId);
    }
    const resultado = await this.dataSource.transaction(async (manager) => {
      if (idempotencyKey) {
        // Evita que retries concorrentes mantenham locks de membership enquanto aguardam a mesma chave.
        await this.lockOperationKey(manager, actor.id, 'deduct', idempotencyKey);
        if (actor && actor.role !== 'superadmin') {
          await this.assertMemberEventInTransaction(manager, actor.id, dto.eventId);
        }
        const anterior = await manager.findOne(BalanceMovementEntity, {
          where: { createdById: actor.id, idempotencyKey, type: MovementType.CONSUME },
          relations: { balance: true },
          withDeleted: true,
        });
        if (anterior) {
          this.assertHashOperacao(anterior, requestHash!);
          if (!anterior.balance) throw new NotFoundException('Saldo do desconto não encontrado');
          return {
            id: anterior.balance.id,
            currentBalance: Number(anterior.balance.currentBalance),
            movement: anterior,
          };
        }
        await this.eventService.assertEventOperavelById(dto.eventId);
      } else if (actor && actor.role !== 'superadmin') {
        await this.assertMemberEventInTransaction(manager, actor.id, dto.eventId);
      }
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

      arquivar?.({ antes: { currentBalance: centavos(Number(balance.currentBalance)) }, eventId: dto.eventId });

      balance.currentBalance = subtrai(Number(balance.currentBalance), montante);
      const savedBalance = await manager.save(BalanceEntity, balance);

      const movement = manager.create(BalanceMovementEntity, {
        balance: savedBalance,
        type: MovementType.CONSUME,
        amount: montante,
        description: dto.description || 'Desconto de saldo (caixa)',
        createdById: actor?.id,
        idempotencyKey,
        requestHash,
      });
      const savedMovement = await manager.save(BalanceMovementEntity, movement);

      return {
        id: savedBalance.id,
        currentBalance: Number(savedBalance.currentBalance),
        movement: savedMovement,
      };
    });

    await this.eventService.vincularCliente(userId, dto.eventId);
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
      select: { id: true },
    });

    let arquivados = 0;
    let removidos = 0;
    for (const candidato of candidatos) {
      // A lista inicial é apenas uma descoberta de IDs. A decisão final tem de
      // usar o estado actual, bloqueado, para não arquivar uma extensão recente
      // nem competir com estornos/transferências que alterem o mesmo saldo.
      await this.dataSource.transaction(async (manager) => {
        const saldo = await manager
          .createQueryBuilder(BalanceEntity, 'saldo')
          .leftJoinAndSelect('saldo.event', 'event')
          .where('saldo.id = :id', { id: candidato.id })
          .setLock('pessimistic_write', undefined, ['saldo'])
          .withDeleted()
          .getOne();
        if (!saldo || saldo.deletedAt) return;

        if (!saldo.archivedAt) {
          if (centavos(Number(saldo.currentBalance)) <= 0) return;
          const deadline = saldoDeadlineUtc(saldo.event, saldo.extendedUntil);
          if (!deadline || now.getTime() <= deadline.getTime()) return;

          saldo.archivedAt = now;
          await manager.save(BalanceEntity, saldo);
          arquivados += 1;
          return;
        }

        if (saldo.archivedAt.getTime() > softDeleteLimite.getTime()) return;
        saldo.deletedAt = now;
        await manager.save(BalanceEntity, saldo);
        removidos += 1;
      });
    }

    return { arquivados, removidos };
  }

  private async carregarSaldoEvento(
    userId: string,
    eventId: string,
    incluirRemovidos = false,
  ): Promise<BalanceEntity> {
    const balance = await this.balanceRepository.findOne({
      where: { user: { id: userId }, event: { id: eventId } } as any,
      relations: { event: true, user: true },
      withDeleted: incluirRemovidos,
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
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, dto.eventId, true);
    const until = new Date(dto.until);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new BadRequestException('Data de extensão tem de ser futura');
    }
    arquivar?.({
      antes: { extendedUntil: balance.extendedUntil ?? null, archivedAt: balance.archivedAt ?? null },
      eventId: dto.eventId,
    });
    balance.extendedUntil = until;
    if (balance.archivedAt) {
      // Extensão para o futuro revive um saldo já arquivado.
      balance.archivedAt = null;
    }
    // A extensão explícita também restaura o registo após o soft-delete de 30 dias.
    balance.deletedAt = null;
    const saved = await this.balanceRepository.save(balance);
    return this.resumoSaldo(userId, saved);
  }

  async unarchiveBalance(
    userId: string,
    eventId: string,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, eventId, true);
    arquivar?.({ antes: { archivedAt: balance.archivedAt ?? null }, eventId });
    balance.archivedAt = null;
    balance.deletedAt = null;
    const saved = await this.balanceRepository.save(balance);
    return this.resumoSaldo(userId, saved);
  }

  async markNotified(
    userId: string,
    eventId: string,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<SaldoEstado> {
    const balance = await this.carregarSaldoEvento(userId, eventId);
    arquivar?.({ antes: { notifiedAt: balance.notifiedAt ?? null }, eventId });
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
  ): Promise<
    {
      userId: string;
      name: string;
      email?: string;
      balance: number;
      archivedAt: string | null;
      notifiedAt: string | null;
      deadline: string | null;
    }[]
  > {
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
    return saldos.map((saldo) => {
      const deadline = saldoDeadlineUtc(evento, saldo.extendedUntil);
      return {
        userId: saldo.user?.id,
        name: saldo.user?.name ?? 'Cliente',
        email: saldo.user?.email,
        balance: Number(saldo.currentBalance),
        archivedAt: saldo.archivedAt ? saldo.archivedAt.toISOString() : null,
        notifiedAt: saldo.notifiedAt ? saldo.notifiedAt.toISOString() : null,
        deadline: deadline ? deadline.toISOString() : null,
      };
    });
  }

  // Saldos do utilizador nos vários eventos em que tem dinheiro — o caixa usa
  // isto para mostrar "Tens €100 no Magusto" e transferir para o evento atual.
  async listBalancesPorEvento(
    userId: string,
    utilizador: any,
  ): Promise<
    {
      eventId: string | null;
      eventName: string;
      balance: number;
      archivedAt: string | null;
      deadline: string | null;
    }[]
  > {
    const saldos = await this.balanceRepository.find({
      where: { user: { id: userId }, currentBalance: MoreThan(0) as any },
      relations: { event: true },
      order: { currentBalance: 'DESC' },
    });

    let eventIdsMembro: string[] | null = null;
    if (utilizador?.role !== 'superadmin') {
      const membros = await this.eventUserRepository.find({
        where: { user: { id: utilizador.id } },
        relations: { event: true },
      });
      eventIdsMembro = membros.map((m) => m.event?.id).filter(Boolean) as string[];
    }

    return saldos
      .filter(
        (s) =>
          !eventIdsMembro ||
          (s.event?.id != null && eventIdsMembro.includes(s.event.id)),
      )
      .map((s) => {
        const deadline = saldoDeadlineUtc(s.event, s.extendedUntil);
        return {
          eventId: s.event?.id ?? null,
          eventName: s.event?.name ?? 'Evento',
          balance: Number(s.currentBalance),
          archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
          deadline: deadline ? deadline.toISOString() : null,
        };
      });
  }

  // Move dinheiro do saldo de um evento (ex.: festa anterior) para o saldo do
  // evento atual. Duas escritas, numa transação com lock: origem a diminuir
  // (movimento CANCEL) e destino a aumentar (movimento LOAD), cada um com a
  // descrição a apontar para o outro evento — sem migração de BD e visível
  // nos históricos/auditoria financeira dos dois lados.
  async transferBalance(
    userId: string,
    dto: TransferBalanceDto,
    actor?: any,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
    rawIdempotencyKey?: string,
  ): Promise<{
    balance: { id: string; currentBalance: number };
    originBalance: { id: string; currentBalance: number };
    movement: BalanceMovementEntity;
    fromEventId: string;
    toEventId: string;
  }> {
    if (dto.fromEventId === dto.toEventId) {
      throw new ForbiddenException('Origem e destino têm de ser eventos diferentes');
    }

    const idempotencyKey = this.validarChaveIdempotencia(rawIdempotencyKey, actor);
    const storedIdempotencyKey = idempotencyKey
      ? this.hashChaveIdempotencia('transfer', idempotencyKey)
      : undefined;
    const requestHash = idempotencyKey
      ? this.hashOperacaoFinanceira('transfer', actor.id, userId, dto.fromEventId, {
          toEventId: dto.toEventId,
          amount: centavos(dto.amount),
        })
      : undefined;

    // A leitura simples permite reproduzir uma transferência confirmada mesmo
    // que o evento de destino tenha fechado entretanto. A operabilidade só é
    // validada depois de procurar um resultado idempotente anterior.
    const toEvent = await this.eventRepository.findOne({ where: { id: dto.toEventId }, withDeleted: true });
    if (!toEvent) {
      throw new NotFoundException('Evento de destino não encontrado');
    }
    const fromEvent = await this.eventRepository.findOne({ where: { id: dto.fromEventId }, withDeleted: true });
    if (!fromEvent) {
      throw new NotFoundException('Evento de origem não encontrado');
    }
    if (actor?.role !== 'superadmin') {
      await this.assertMemberEvent(actor.id, dto.fromEventId);
      await this.assertMemberEvent(actor.id, dto.toEventId);
    }

    const montante = centavos(dto.amount);
    const resultado = await this.dataSource.transaction(async (manager) => {
      if (idempotencyKey && storedIdempotencyKey) {
        // Serializar retries antes de adquirir os locks de membership.
        await this.lockOperationKey(manager, actor.id, 'transfer', idempotencyKey);
      }
      if (actor && actor.role !== 'superadmin') {
        // Adquirir locks de membership na mesma ordem para transferências A→B e B→A.
        for (const eventId of [...new Set([dto.fromEventId, dto.toEventId])].sort()) {
          await this.assertMemberEventInTransaction(manager, actor.id, eventId);
        }
      }
      if (idempotencyKey && storedIdempotencyKey) {
        const movimentoDestinoAnterior = await manager.findOne(BalanceMovementEntity, {
          where: {
            createdById: actor.id,
            type: MovementType.LOAD,
            idempotencyKey: storedIdempotencyKey,
          },
          relations: { balance: true },
          withDeleted: true,
        });
        const movimentoOrigemAnterior = await manager.findOne(BalanceMovementEntity, {
          where: {
            createdById: actor.id,
            type: MovementType.CANCEL,
            idempotencyKey: storedIdempotencyKey,
          },
          relations: { balance: true },
          withDeleted: true,
        });

        if (movimentoDestinoAnterior || movimentoOrigemAnterior) {
          if (!movimentoDestinoAnterior || !movimentoOrigemAnterior) {
            throw new ConflictException('Transferência idempotente incompleta');
          }
          this.assertHashOperacao(movimentoDestinoAnterior, requestHash!);
          this.assertHashOperacao(movimentoOrigemAnterior, requestHash!);
          if (!movimentoDestinoAnterior.balance || !movimentoOrigemAnterior.balance) {
            throw new NotFoundException('Saldo da transferência não encontrado');
          }
          const saldoDestinoAnterior = await manager.findOne(BalanceEntity, {
            where: { id: movimentoDestinoAnterior.balance.id },
            withDeleted: true,
          });
          const saldoOrigemAnterior = await manager.findOne(BalanceEntity, {
            where: { id: movimentoOrigemAnterior.balance.id },
            withDeleted: true,
          });
          if (!saldoDestinoAnterior || !saldoOrigemAnterior) {
            throw new NotFoundException('Saldo da transferência não encontrado');
          }
          return {
            balance: {
              id: saldoDestinoAnterior.id,
              currentBalance: Number(saldoDestinoAnterior.currentBalance),
            },
            originBalance: {
              id: saldoOrigemAnterior.id,
              currentBalance: Number(saldoOrigemAnterior.currentBalance),
            },
            movement: movimentoDestinoAnterior,
            fromEventId: dto.fromEventId,
            toEventId: dto.toEventId,
          };
        }
      }

      if (fromEvent.deletedAt) {
        throw new NotFoundException('Evento de origem não encontrado');
      }
      const eventoDestinoOperavel = await this.eventService.assertEventOperavelById(dto.toEventId);

      // Todas as transferências bloqueiam os saldos pela mesma ordem de evento.
      // Sem isto, A→B e B→A podem bloquear origem/destino em ordem inversa.
      const saldosPorEvento = new Map<string, BalanceEntity>();
      for (const eventId of [dto.fromEventId, dto.toEventId].sort()) {
        const saldo = await manager.findOne(BalanceEntity, {
          where: { user: { id: userId }, event: { id: eventId } } as any,
          lock: { mode: 'pessimistic_write' },
          withDeleted: eventId === dto.toEventId,
        });
        if (saldo) saldosPorEvento.set(eventId, saldo);
      }

      const origem = saldosPorEvento.get(dto.fromEventId);
      if (!origem) {
        throw new NotFoundException('O utilizador não tem saldo no evento de origem');
      }
      if (centavos(Number(origem.currentBalance)) < montante) {
        throw new ForbiddenException('Saldo insuficiente no evento de origem');
      }

      let destino = saldosPorEvento.get(dto.toEventId) ?? null;
      if (!destino) {
        const userEntity = await manager.findOne(UserEntity, {
          where: { id: userId },
        });
        if (!userEntity) {
          throw new NotFoundException('Utilizador não encontrado');
        }
        destino = manager.create(BalanceEntity, {
          user: userEntity,
          event: { id: dto.toEventId } as EventEntity,
          currentBalance: 0,
        });
        await manager.save(BalanceEntity, destino);
      } else {
        // O dinheiro chega agora ao destino: restaura o registo se tinha sido
        // arquivado/soft-deleted e mantém a unicidade user/event.
        destino.archivedAt = null;
        destino.deletedAt = null;
      }

      arquivar?.({
        antes: {
          originBalance: { id: origem.id, currentBalance: centavos(Number(origem.currentBalance)) },
          destinationBalance: { id: destino.id, currentBalance: centavos(Number(destino.currentBalance)) },
        },
        eventId: dto.toEventId,
        extras: { fromEventId: dto.fromEventId, toEventId: dto.toEventId },
      });

      origem.currentBalance = subtrai(Number(origem.currentBalance), montante);
      destino.currentBalance = soma(Number(destino.currentBalance), montante);
      const origemSalva = await manager.save(BalanceEntity, origem);
      const destinoSalvo = await manager.save(BalanceEntity, destino);

      const movOrigem = manager.create(BalanceMovementEntity, {
        balance: origemSalva,
        type: MovementType.CANCEL,
        amount: montante,
        description: `Transferência para ${eventoDestinoOperavel.name}`,
        createdById: actor?.id,
        idempotencyKey: storedIdempotencyKey,
        requestHash,
      });
      await manager.save(BalanceMovementEntity, movOrigem);

      const movDestino = manager.create(BalanceMovementEntity, {
        balance: destinoSalvo,
        type: MovementType.LOAD,
        amount: montante,
        description: `Transferência de ${fromEvent.name}`,
        createdById: actor?.id,
        idempotencyKey: storedIdempotencyKey,
        requestHash,
      });
      await manager.save(BalanceMovementEntity, movDestino);

      return {
        balance: {
          id: destinoSalvo.id,
          currentBalance: Number(destinoSalvo.currentBalance),
        },
        originBalance: {
          id: origemSalva.id,
          currentBalance: Number(origemSalva.currentBalance),
        },
        movement: movDestino,
        fromEventId: dto.fromEventId,
        toEventId: dto.toEventId,
      };
    });

    await this.eventService.vincularCliente(userId, dto.toEventId);
    return resultado;
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
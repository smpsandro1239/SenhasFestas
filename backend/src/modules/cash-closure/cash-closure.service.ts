import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CashClosureEntity, EventUserEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { EventService } from '../event/event.service';
import { CreateCashClosureDto, CloseCashClosureDto } from './dto';
import { centavos } from '../../common/money';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';
import { FINANCE_ROLES } from '../../common/roles';

@Injectable()
export class CashClosureService {
  constructor(
    @InjectRepository(CashClosureEntity)
    private readonly cashClosureRepository: Repository<CashClosureEntity>,
    private readonly membershipService: MembershipService,
    private readonly eventService: EventService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private async assertFinanceMembershipInTransaction(
    manager: import('typeorm').EntityManager,
    utilizador: any,
    eventId: string,
  ): Promise<void> {
    if (!utilizador?.id) {
      throw new ForbiddenException('Não autenticado');
    }
    if (utilizador.role === 'superadmin') {
      return;
    }
    const membership = await manager.findOne(EventUserEntity, {
      where: { event: { id: eventId }, user: { id: utilizador.id } },
      lock: { mode: 'pessimistic_read' },
    });
    if (!membership) {
      throw new ForbiddenException('Não pertence a este evento');
    }
    if (typeof membership.role === 'string' && !FINANCE_ROLES.includes(membership.role)) {
      throw new ForbiddenException('A tua função neste evento não permite operações de caixa');
    }
  }

  private async assertEventMembershipInTransaction(
    manager: import('typeorm').EntityManager,
    utilizador: any,
    eventId: string,
  ): Promise<void> {
    if (!utilizador?.id) {
      throw new ForbiddenException('Não autenticado');
    }
    if (utilizador.role === 'superadmin') {
      return;
    }
    const membership = await manager.findOne(EventUserEntity, {
      where: { event: { id: eventId }, user: { id: utilizador.id } },
      lock: { mode: 'pessimistic_read' },
    });
    if (!membership) {
      throw new ForbiddenException('Não pertence a este evento');
    }
  }

  async abrirCaixa(
    operadorId: string,
    utilizador: any,
    dto: CreateCashClosureDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<CashClosureEntity> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertFinanceMembershipInTransaction(manager, utilizador, dto.eventId);
      await this.eventService.assertEventOperavelById(dto.eventId);

      // O lock da membership mantém a autorização estável até à criação.
      const jaAberta = await manager.findOne(CashClosureEntity, {
        where: { eventId: dto.eventId, status: 'open' },
      });
      if (jaAberta) {
        throw new ConflictException('Já existe uma caixa aberta neste evento');
      }

      const novoFecho = this.cashClosureRepository.create({
        eventId: dto.eventId,
        openedById: operadorId,
        openingBalance: dto.openingBalance === undefined ? 0 : centavos(dto.openingBalance),
        openedAt: new Date(),
        notes: dto.notes,
        status: 'open',
      });
      let salvo: CashClosureEntity;
      try {
        salvo = await manager.save(CashClosureEntity, novoFecho);
      } catch (error) {
        const codigo = (error as any)?.code ?? (error as any)?.driverError?.code;
        if (codigo === '23505') {
          throw new ConflictException('Já existe uma caixa aberta neste evento');
        }
        throw error;
      }
      arquivar?.({ entidadeId: salvo.id, eventId: dto.eventId });
      return salvo;
    });
  }

  async fecharCaixa(
    id: string,
    operadorId: string,
    utilizador: any,
    dto: CloseCashClosureDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<CashClosureEntity> {
    return this.dataSource.transaction(async (manager) => {
      // Lock pessimista: duas requisições concorrentes não podem fechar a mesma
      // caixa com totais diferentes nem substituir o operador responsável.
      const fecho = await manager.findOne(CashClosureEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fecho) {
        throw new NotFoundException('Caixa não encontrado');
      }

      // A role e a membership actuais ficam bloqueadas até à gravação do fecho.
      await this.assertFinanceMembershipInTransaction(manager, utilizador, fecho.eventId);

      const fechoPorSuperadmin = utilizador?.role === 'superadmin' && fecho.openedById !== operadorId;
      if (fecho.openedById !== operadorId && !fechoPorSuperadmin) {
        throw new ForbiddenException('Só o operador que abriu ou um superadmin pode fechar a caixa');
      }
      if (fecho.status === 'closed') {
        throw new ConflictException('Caixa já está fechado');
      }

      const antes = {
        status: fecho.status,
        closedAt: fecho.closedAt ?? null,
        closingBalance: fecho.closingBalance ?? null,
        closedById: fecho.closedById ?? null,
      };

      arquivar?.({
        antes,
        eventId: fecho.eventId,
        extras: { abertoPor: fecho.openedById, fechoPorSuperadmin },
      });

      fecho.closedAt = new Date();
      fecho.closingBalance = centavos(dto.totalActual);
      fecho.status = 'closed';
      fecho.closedById = operadorId;
      if (dto.notes) fecho.notes = dto.notes;

      return manager.save(CashClosureEntity, fecho);
    });
  }

  async listarPorEvento(eventoId: string, utilizador: any): Promise<CashClosureEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertEventMembershipInTransaction(manager, utilizador, eventoId);
      return manager.find(CashClosureEntity, {
        where: { eventId: eventoId },
        order: { openedAt: 'DESC' },
      });
    });
  }

  async obterPorId(id: string, utilizador: any): Promise<CashClosureEntity> {
    return this.dataSource.transaction(async (manager) => {
      const fecho = await manager.findOne(CashClosureEntity, { where: { id } });
      if (!fecho) {
        throw new NotFoundException('Caixa não encontrado');
      }
      await this.assertEventMembershipInTransaction(manager, utilizador, fecho.eventId);
      return fecho;
    });
  }

  async obterCaixaAberta(eventoId: string, utilizador: any): Promise<CashClosureEntity> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertEventMembershipInTransaction(manager, utilizador, eventoId);
      return manager.findOne(CashClosureEntity, {
        where: { eventId: eventoId, status: 'open' },
        // A9: com o índice único nunca há duas abertas, mas caixas duplicadas
        // legadas podem existir em produção — sem order, o findOne devolve uma
        // arbitrária. Ordenar torna o comportamento determinístico até a migração
        // as fechar.
        order: { openedAt: 'DESC' },
      });
    });
  }
}
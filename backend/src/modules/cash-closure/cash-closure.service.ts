import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CashClosureEntity, EventUserEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { EventService } from '../event/event.service';
import { CreateCashClosureDto, CloseCashClosureDto } from './dto';
import { centavos } from '../../common/money';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

@Injectable()
export class CashClosureService {
  constructor(
    @InjectRepository(CashClosureEntity)
    private readonly cashClosureRepository: Repository<CashClosureEntity>,
    private readonly membershipService: MembershipService,
    private readonly eventService: EventService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async abrirCaixa(
    operadorId: string,
    utilizador: any,
    dto: CreateCashClosureDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<CashClosureEntity> {
    await this.membershipService.assertMember(utilizador, dto.eventId);
    await this.eventService.assertEventOperavelById(dto.eventId);

    // A9: uma caixa aberta por evento. Duas caixas abertas é erro humano
    // (dois operadores a clicar, ou recarregar a página e clicar outra vez),
    // não um estado legítimo. A corrida verdadeira é fechada pelo partial
    // unique index na migração; esta validação dá a mensagem clara.
    const jaAberta = await this.cashClosureRepository.findOne({
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
    const salvo = await this.cashClosureRepository.save(novoFecho);
    arquivar?.({
      entidadeId: salvo.id,
      eventId: dto.eventId,
    });
    return salvo;
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

      // A autorização é verificada dentro da mesma transação e contra a
      // membership actual do evento, evitando uma revogação concorrente entre
      // a verificação e a gravação do fecho.
      if (utilizador?.role !== 'superadmin') {
        const membro = await manager.findOne(EventUserEntity, {
          where: { event: { id: fecho.eventId }, user: { id: utilizador?.id } },
        });
        if (!membro) {
          throw new ForbiddenException('Não pertence a este evento');
        }
      }

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
    await this.membershipService.assertMember(utilizador, eventoId);
    return this.cashClosureRepository.find({
      where: { eventId: eventoId },
      order: { openedAt: 'DESC' },
    });
  }

  async obterPorId(id: string, utilizador: any): Promise<CashClosureEntity> {
    const fecho = await this.cashClosureRepository.findOne({ where: { id } });
    if (!fecho) {
      throw new NotFoundException('Caixa não encontrado');
    }
    await this.membershipService.assertMember(utilizador, fecho.eventId);
    return fecho;
  }

  async obterCaixaAberta(eventoId: string, utilizador: any): Promise<CashClosureEntity> {
    await this.membershipService.assertMember(utilizador, eventoId);
    return this.cashClosureRepository.findOne({
      where: { eventId: eventoId, status: 'open' },
      // A9: com o índice único nunca há duas abertas, mas caixas duplicadas
      // legadas podem existir em produção — sem order, o findOne devolve uma
      // arbitrária. Ordenar torna o comportamento determinístico até a migração
      // as fechar.
      order: { openedAt: 'DESC' },
    });
  }
}
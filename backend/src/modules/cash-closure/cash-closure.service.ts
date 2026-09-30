import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashClosureEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { EventService } from '../event/event.service';
import { CreateCashClosureDto, CloseCashClosureDto } from './dto';
import { centavos } from '../../common/money';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CashClosureService {
  constructor(
    @InjectRepository(CashClosureEntity)
    private readonly cashClosureRepository: Repository<CashClosureEntity>,
    private readonly membershipService: MembershipService,
    private readonly eventService: EventService,
    private readonly auditService: AuditService,
  ) {}

  async abrirCaixa(
    operadorId: string,
    utilizador: any,
    dto: CreateCashClosureDto,
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
    await this.auditService.record({
      action: 'CREATE',
      entity: 'cash-closure',
      entityId: salvo.id,
      eventId: dto.eventId,
      actorId: operadorId,
      actorRole: utilizador?.role ?? 'unknown',
      after: { status: 'open', openingBalance: salvo.openingBalance },
    });
    return salvo;
  }

  async fecharCaixa(
    id: string,
    operadorId: string,
    utilizador: any,
    dto: CloseCashClosureDto,
  ): Promise<CashClosureEntity> {
    const fecho = await this.cashClosureRepository.findOne({ where: { id } });
    if (!fecho) {
      throw new NotFoundException('Caixa não encontrado');
    }
    await this.membershipService.assertMember(utilizador, fecho.eventId);

    // A9: quem abriu é o responsável normal do fecho, mas o dinheiro é do
    // evento. Se ele ficar doente, sair ou perder o browser, o superadmin
    // fecha. Não é qualquer FINANCE — isso destruiria a responsabilidade.
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

    fecho.closedAt = new Date();
    fecho.closingBalance = centavos(dto.totalActual);
    fecho.status = 'closed';
    fecho.closedById = operadorId;
    if (dto.notes) fecho.notes = dto.notes;

    const salvo = await this.cashClosureRepository.save(fecho);
    await this.auditService.record({
      action: 'CLOSE',
      entity: 'cash-closure',
      entityId: salvo.id,
      eventId: salvo.eventId,
      actorId: operadorId,
      actorRole: utilizador?.role ?? 'unknown',
      before: antes,
      after: {
        status: 'closed',
        closedAt: fecho.closedAt,
        closingBalance: fecho.closingBalance,
        closedById: operadorId,
      },
      details: { abertoPor: fecho.openedById, fechoPorSuperadmin },
    });
    return salvo;
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
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, MoreThan } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  EventEntity,
  EventUserEntity,
  UserEntity,
  OrderEntity,
  CashClosureEntity,
  BalanceEntity,
} from '../../entities';
import { CreateEventDto, UpdateEventDto, AddMemberDto, EventSettingsDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { eventWindowMessage, isEventWindowOpen } from '../../common/event-window';
import {
  FORMATO_SHORT_CODE,
  normalizarShortCode,
  gerarShortCode,
  escolherShortCode,
} from '../../common/short-code';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(CashClosureEntity)
    private readonly cashClosureRepository: Repository<CashClosureEntity>,
    private readonly auditService: AuditService,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
  ) {}

  async findByUser(user: any): Promise<EventEntity[]> {
    await this.autoCloseExpired();
    if (user?.role === 'superadmin') {
      return this.eventRepository.find();
    }
    return this.eventRepository
      .createQueryBuilder('event')
      .innerJoin(EventUserEntity, 'eu', 'eu.eventId = event.id')
      .where('eu.userId = :userId', { userId: user?.id })
      .getMany();
  }

  /**
   * Lista pública (sem membership): só eventos activos dentro da janela,
   * com os campos mínimos para o dropdown do /qr-order (nome + shortCode).
   * O shortCode permite entrar no evento pelo mesmo fluxo do /entrar.
   */
  async listEventosPublicos(
    now: Date = new Date(),
  ): Promise<Array<{ id: string; name: string; shortCode: string }>> {
    const eventos = await this.eventRepository.find({ where: { status: 'active' as any } });
    return eventos
      .filter((evento) => evento.status === 'active' && isEventWindowOpen(evento, now))
      .map((evento) => ({
        id: evento.id,
        name: evento.name,
        shortCode: evento.shortCode ?? '',
      }));
  }

  /**
   * Fecha eventos ativos cuja janela (endDate + 1 dia às 06:00 Europe/Lisbon)
   * já passou. Idempotente: o UPDATE só afeta linhas ainda 'active', evitando
   * duplicação de auditoria se o cron e o lazy check correrem em simultâneo.
   */
  async autoCloseExpired(now: Date = new Date()): Promise<number> {
    const ativos = await this.eventRepository.find({ where: { status: 'active' as any } });
    let fechados = 0;
    for (const evento of ativos) {
      const motivo = eventWindowMessage(evento, now);
      if (!motivo?.includes('terminou')) continue;
      const { affected } = await this.eventRepository.update(
        { id: evento.id, status: 'active' as any },
        { status: 'closed' as any },
      );
      if (affected !== 1) continue;
      fechados += 1;
      await this.auditService.record({
        action: 'STATUS',
        entity: 'event',
        entityId: evento.id,
        eventId: evento.id,
        actorId: undefined,
        actorRole: 'system',
        after: { status: 'closed' },
        details: { automatico: true, motivo, fechadoEm: now.toISOString() },
      });
    }
    return fechados;
  }

  /**
   * Guard financeiro/operacional: o evento tem de estar a decorrer dentro da
   * janela de datas. Se a janela já passou e o evento ainda está 'active',
   * fecha-o (idempotente + auditoria) antes de lançar — o auto-close nunca
   * bloqueia por mais do que um UPDATE condicional.
   */
  async assertEventOperavel(event: EventEntity, now: Date = new Date()): Promise<void> {
    const hoje = now;
    const motivo = eventWindowMessage(event, hoje);
    if (event.status !== 'active') {
      throw new ForbiddenException(
        event.status === 'draft' ? 'Evento ainda não está ativo' : 'Evento encerrado',
      );
    }
    if (motivo) {
      if (motivo.includes('terminou')) {
        const { affected } = await this.eventRepository.update(
          { id: event.id, status: 'active' as any },
          { status: 'closed' as any },
        );
        if (affected === 1) {
          await this.auditService.record({
            action: 'STATUS',
            entity: 'event',
            entityId: event.id,
            eventId: event.id,
            actorId: undefined,
            actorRole: 'system',
            after: { status: 'closed' },
            details: { automatico: true, motivo, fechadoEm: hoje.toISOString() },
          });
        }
      }
      throw new ForbiddenException(motivo);
    }
  }

  async assertEventOperavelById(eventId: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    await this.assertEventOperavel(event);
    return event;
  }

  async findOne(id: string, user: UserEntity): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const isMember = await this.eventUserRepository.findOne({
      where: { event: { id }, user: { id: user.id } },
    });
    if (!isMember && user.role !== 'superadmin') {
      throw new ForbiddenException('Not a member of this event');
    }

    return event;
  }

  async create(user: UserEntity, dto: CreateEventDto): Promise<EventEntity> {
    const id = randomUUID();
    const shortCode = await this.resolverShortCodeParaCriacao(dto, id);
    const event = this.eventRepository.create({
      ...dto,
      id,
      shortCode,
      status: 'draft',
    });
    const savedEvent = await this.eventRepository.save(event);

    if (user.role !== 'superadmin') {
      await this.addUserRole(savedEvent.id, user.id, 'organizer');
    }

    return savedEvent;
  }

  async update(id: string, user: UserEntity, dto: UpdateEventDto): Promise<EventEntity> {
    const event = await this.findOne(id, user);
    if (dto.shortCode !== undefined) {
      const normalizado = this.validarShortCode(dto.shortCode);
      const existentes = await this.shortCodesExistentes();
      if (existentes.has(normalizado) && normalizado !== event.shortCode) {
        throw new ConflictException('shortCode já está em uso');
      }
      dto = { ...dto, shortCode: normalizado };
    }
    Object.assign(event, dto);
    return this.eventRepository.save(event);
  }

  async findByCode(codigo: string): Promise<{ id: string; name: string; shortCode: string }> {
    const normalizado = normalizarShortCode(codigo);
    const event = await this.eventRepository.findOne({ where: { shortCode: normalizado } });
    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }
    return { id: event.id, name: event.name, shortCode: event.shortCode };
  }

  async vincularCliente(userId: string, eventId: string): Promise<void> {
    const existente = await this.eventUserRepository.findOne({
      where: { event: { id: eventId }, user: { id: userId } },
    });
    if (!existente) {
      await this.addUserRole(eventId, userId, 'client');
    }
  }

  async entrar(
    userId: string,
    eventCode: string,
    replace: boolean,
  ): Promise<{ eventId: string; eventName: string; replaces: number }> {
    const evento = await this.findByCode(eventCode);
    const membroAtual = await this.eventUserRepository.findOne({
      where: { event: { id: evento.id }, user: { id: userId } },
    });

    let replaces = 0;
    if (replace) {
      const saldoNoutroEvento = await this.balanceRepository.findOne({
        where: {
          user: { id: userId },
          event: { id: Not(evento.id) },
          currentBalance: MoreThan(0),
        },
        relations: { event: true },
      });
      if (saldoNoutroEvento) {
        throw new ConflictException(
          `Tens saldo no evento "${saldoNoutroEvento.event?.name}". Usa o QR desse evento ou esgota o saldo antes de trocar.`,
        );
      }
      const anteriores = await this.eventUserRepository.find({
        where: { user: { id: userId }, event: { id: Not(evento.id) } },
      });
      if (anteriores.length > 0) {
        await this.eventUserRepository.remove(anteriores);
        replaces = anteriores.length;
      }
    }

    if (!membroAtual) {
      await this.addUserRole(evento.id, userId, 'client');
    }

    return { eventId: evento.id, eventName: evento.name, replaces };
  }

  private validarShortCode(valor: string): string {
    const normalizado = normalizarShortCode(valor);
    if (!FORMATO_SHORT_CODE.test(normalizado)) {
      throw new BadRequestException(
        'shortCode inválido: use 3-32 caracteres minúsculos, números e hífens',
      );
    }
    return normalizado;
  }

  private async shortCodesExistentes(): Promise<Set<string>> {
    const linhas = await this.eventRepository.find({ select: { shortCode: true } });
    return new Set(linhas.map((linha) => linha.shortCode));
  }

  private async resolverShortCodeParaCriacao(dto: CreateEventDto, id: string): Promise<string> {
    if (dto.shortCode !== undefined) {
      const normalizado = this.validarShortCode(dto.shortCode);
      const existentes = await this.shortCodesExistentes();
      if (existentes.has(normalizado)) {
        throw new ConflictException('shortCode já está em uso');
      }
      return normalizado;
    }
    const base = gerarShortCode(dto.name, id);
    const existentes = await this.shortCodesExistentes();
    return escolherShortCode(base, (cand) => existentes.has(cand));
  }

  async updateStatus(
    id: string,
    user: UserEntity,
    status: 'draft' | 'active' | 'closed',
  ): Promise<EventEntity> {
    const event = await this.findOne(id, user);
    if (status === 'active') {
      const motivo = eventWindowMessage(event, new Date());
      if (motivo?.includes('terminou')) {
        throw new ConflictException(
          'Não é possível reabrir o evento: a data de fim já passou. Aumente a data primeiro.',
        );
      }
    }
    event.status = status;
    return this.eventRepository.save(event);
  }

  async getSettings(id: string, user: UserEntity): Promise<Record<string, any>> {
    const event = await this.findOne(id, user);
    return event.settings ?? {};
  }

  async updateSettings(
    id: string,
    user: UserEntity,
    settings: EventSettingsDto,
  ): Promise<Record<string, any>> {
    const event = await this.findOne(id, user);
    event.settings = { ...(event.settings ?? {}), ...settings };
    await this.eventRepository.save(event);
    return event.settings;
  }

  async addUserRole(eventId: string, userId: string, role: string): Promise<EventUserEntity> {
    const eventUser = this.eventUserRepository.create({
      event: { id: eventId } as any,
      user: { id: userId } as any,
      role,
    });
    return this.eventUserRepository.save(eventUser);
  }

  async listMembers(eventId: string, user: UserEntity): Promise<any[]> {
    await this.findOne(eventId, user);
    const members = await this.eventUserRepository.find({
      where: { event: { id: eventId } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.user?.id,
      email: m.user?.email,
      name: m.user?.name,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }

  private assertPodeAtribuirRole(user: UserEntity, role: string): void {
    if (role === 'superadmin') {
      throw new ForbiddenException('Não é possível atribuir a função superadmin no evento');
    }
    if (user.role !== 'superadmin' && role === 'organizer') {
      throw new ForbiddenException('Apenas o superadmin pode atribuir a função organizer');
    }
  }

  async addMember(eventId: string, user: UserEntity, dto: AddMemberDto): Promise<EventUserEntity> {
    await this.findOne(eventId, user);
    this.assertPodeAtribuirRole(user, dto.role);
    const userId = dto.userId;
    const existing = await this.eventUserRepository.findOne({
      where: { event: { id: eventId }, user: { id: userId } },
    });
    if (existing) {
      existing.role = dto.role;
      return this.eventUserRepository.save(existing);
    }
    return this.addUserRole(eventId, userId, dto.role);
  }

  async removeMember(eventId: string, user: UserEntity, userId: string): Promise<{ removed: boolean }> {
    await this.findOne(eventId, user);
    await this.eventUserRepository.delete({
      event: { id: eventId },
      user: { id: userId },
    } as any);
    return { removed: true };
  }

  async remove(id: string, user: UserEntity): Promise<{ deleted: boolean; softDelete: boolean }> {
    await this.findOne(id, user);

    const pedidosAtivos = await this.orderRepository.count({
      where: { event: { id } as any, status: In(['received', 'preparing', 'ready']) },
    });
    if (pedidosAtivos > 0) {
      throw new ConflictException('Não é possível eliminar um evento com pedidos em curso');
    }

    const caixaAberto = await this.cashClosureRepository.count({
      where: { eventId: id, status: 'open' },
    });
    if (caixaAberto > 0) {
      throw new ConflictException('Feche o caixa antes de eliminar o evento');
    }

    await this.eventRepository.update(
      { id },
      { deletedAt: new Date(), status: 'closed' },
    );

    return { deleted: true, softDelete: true };
  }
}
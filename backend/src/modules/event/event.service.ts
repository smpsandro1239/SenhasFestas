import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  EventEntity,
  EventUserEntity,
  UserEntity,
  OrderEntity,
  CashClosureEntity,
} from '../../entities';
import { CreateEventDto, UpdateEventDto, AddMemberDto, EventSettingsDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { eventWindowMessage } from '../../common/event-window';

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
    const event = this.eventRepository.create({
      ...dto,
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
    Object.assign(event, dto);
    return this.eventRepository.save(event);
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
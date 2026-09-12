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
  ) {}

  async findByUser(user: any): Promise<EventEntity[]> {
    if (user?.role === 'superadmin') {
      return this.eventRepository.find();
    }
    return this.eventRepository
      .createQueryBuilder('event')
      .innerJoin(EventUserEntity, 'eu', 'eu.eventId = event.id')
      .where('eu.userId = :userId', { userId: user?.id })
      .getMany();
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

  async addMember(eventId: string, user: UserEntity, dto: AddMemberDto): Promise<EventUserEntity> {
    await this.findOne(eventId, user);
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
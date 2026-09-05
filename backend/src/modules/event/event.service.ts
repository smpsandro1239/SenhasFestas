import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  EventEntity,
  EventUserEntity,
  UserEntity,
  OrderEntity,
  BalanceEntity,
  ProductEntity,
  BalanceMovementEntity,
  CategoryEntity,
  StationEntity,
} from '../../entities';
import { CreateEventDto, UpdateEventDto } from './dto';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByUser(userId: string): Promise<EventEntity[]> {
    return this.eventRepository
      .createQueryBuilder('event')
      .innerJoin(EventUserEntity, 'eu', 'eu.eventId = event.id')
      .where('eu.userId = :userId', { userId })
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

  async addUserRole(eventId: string, userId: string, role: string): Promise<EventUserEntity> {
    const eventUser = this.eventUserRepository.create({
      event: { id: eventId } as any,
      user: { id: userId } as any,
      role,
    });
    return this.eventUserRepository.save(eventUser);
  }

  async remove(id: string, user: UserEntity): Promise<{ deleted: boolean }> {
    await this.findOne(id, user);
    const balanceIds = (
      await this.balanceRepository.find({ where: { event: { id } as any }, select: { id: true } })
    ).map((b) => b.id);

    await this.dataSource.transaction(async (manager) => {
      if (balanceIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(BalanceMovementEntity)
          .where('"balanceId" IN (:...balanceIds)', { balanceIds })
          .execute();
      }
      await manager.delete(OrderEntity, { event: { id } as any });
      await manager.delete(BalanceEntity, { event: { id } as any });
      await manager.delete(ProductEntity, { event: { id } as any });
      await manager.delete(CategoryEntity, { event: { id } as any });
      await manager.delete(StationEntity, { event: { id } as any });
      await manager.delete(EventUserEntity, { event: { id } as any });
      await manager.delete(EventEntity, { id });
    });

    return { deleted: true };
  }
}
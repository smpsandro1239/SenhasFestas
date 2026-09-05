import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, EventUserEntity } from '../../entities';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
  ) {}

  private async obterEventosDoUtilizador(utilizador: any): Promise<string[]> {
    if (!utilizador || utilizador.role === 'superadmin') {
      return [];
    }
    const membros = await this.eventUserRepository.find({
      where: { user: { id: utilizador.id } as any },
      relations: { event: true },
    });
    return membros.map((m) => m.event?.id).filter((id): id is string => Boolean(id));
  }

  async obterOrdens(filtros: OrdensQueryDto, utilizador: any) {
    const eventIds = await this.obterEventosDoUtilizador(utilizador);

    const query = this.orderRepository
      .createQueryBuilder('orden')
      .leftJoinAndSelect('orden.items', 'itens')
      .leftJoinAndSelect('itens.product', 'product')
      .orderBy('orden.createdAt', 'ASC');

    if (filtros.status) {
      query.andWhere('orden.status = :status', { status: filtros.status });
    } else {
      query.andWhere('orden.status IN (:...status)', {
        status: ['received', 'preparing'],
      });
    }

    if (filtros.station) {
      query.andWhere('orden.station = :station', { station: filtros.station });
    }

    if (filtros.eventId) {
      query.andWhere('orden.eventId = :eventId', { eventId: filtros.eventId });
    } else if (eventIds.length > 0) {
      query.andWhere('orden.eventId IN (:...eventIds)', { eventIds });
    }

    const page = filtros?.page ?? 1;
    const limit = filtros?.limit ?? 20;
    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async obterSaldo(filtros: SaldoQueryDto) {
    if (!filtros?.id) {
      return [];
    }
    return this.movementRepository
      .createQueryBuilder('movimentacao')
      .where('movimentacao.balanceId = :id', { id: filtros.id })
      .orderBy('movimentacao.createdAt', 'ASC')
      .getMany();
  }

  async topProducts(filtros: TopProductsQueryDto, utilizador?: any) {
    const eventIds = await this.obterEventosDoUtilizador(utilizador);

    const query = this.orderItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.price', 'price')
      .addSelect('SUM(item.quantity)', 'totalVendido')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.price')
      .orderBy('"totalVendido"', 'DESC')
      .limit(10);

    if (filtros?.eventId) {
      query.innerJoin('item.order', 'ordenEm').andWhere('ordenEm.eventId = :eventId', { eventId: filtros.eventId });
    } else if (eventIds.length > 0) {
      query.innerJoin('item.order', 'ordenEm').andWhere('ordenEm.eventId IN (:...eventIds)', { eventIds });
    }

    return query.getRawMany();
  }

  async obterEstatisticas(utilizador?: any) {
    const eventIds = await this.obterEventosDoUtilizador(utilizador);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const condicoes = (where: Record<string, unknown>, extra?: Record<string, unknown>) => {
      const base: Record<string, unknown> = { ...where };
      if (eventIds.length > 0) {
        base.eventId = In(eventIds);
      }
      return { ...base, ...extra };
    };

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      this.orderRepository.count(condicoes({ status: 'received' })),
      this.orderRepository.count(condicoes({ status: 'preparing' })),
      this.orderRepository.count(condicoes({ status: 'ready' })),
      this.orderRepository
        .createQueryBuilder('orden')
        .where('orden.status = :status', { status: 'delivered' })
        .andWhere('orden.updatedAt >= :hoje', { hoje })
        .andWhere(eventIds.length > 0 ? 'orden.eventId IN (:...eventIds)' : '1=1', eventIds.length > 0 ? { eventIds } : {})
        .getCount(),
    ]);

    return {
      recebidos,
      emPreparacao,
      prontos,
      entregues,
      total: recebidos + emPreparacao + prontos,
    };
  }
}
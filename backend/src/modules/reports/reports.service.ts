import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, BalanceEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto } from './dto';

const LIMITE_EXPORTACAO = 5000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    private readonly membershipService: MembershipService,
  ) {}

  private construirQueryOrdens(
    filtros: OrdensQueryDto,
    eventIds: string[] | null,
  ): SelectQueryBuilder<OrderEntity> {
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

    const scope = this.membershipService.eventColumnFor(eventIds, filtros.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }
    return query;
  }

  async obterOrdens(filtros: OrdensQueryDto, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const page = filtros?.page ?? 1;
    const limit = filtros?.limit ?? 20;
    const [items, total] = await this.construirQueryOrdens(filtros, eventIds)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async exportOrdensCsv(filtros: OrdensQueryDto, utilizador: any): Promise<string> {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const items = await this.construirQueryOrdens(filtros, eventIds)
      .take(LIMITE_EXPORTACAO)
      .getMany();

    const cabecalho = [
      'id',
      'createdAt',
      'status',
      'source',
      'tableNumber',
      'station',
      'total',
      'balanceUsed',
      'paymentMethod',
      'eventId',
      'itens',
    ];
    const escapar = (valor: unknown): string => {
      if (Array.isArray(valor)) {
        valor = valor
          .map((item) => `${item.quantity}x ${item.product?.name ?? item.productId ?? ''} (${item.subtotal})`)
          .join(' | ');
      }
      const texto =
        valor === null || valor === undefined
          ? ''
          : typeof valor === 'object'
            ? JSON.stringify(valor)
            : String(valor);
      return `"${texto.replace(/"/g, '""')}"`;
    };
    const linhas = items.map((orden) =>
      [
        orden.id,
        orden.createdAt instanceof Date ? orden.createdAt.toISOString() : orden.createdAt,
        orden.status,
        orden.source,
        orden.tableNumber,
        orden.station,
        orden.total,
        orden.balanceUsed,
        orden.paymentMethod,
        (orden as any).event?.id,
        (orden as any).items,
      ]
        .map(escapar)
        .join(','),
    );
    return [cabecalho.join(','), ...linhas].join('\n');
  }

  async obterSaldo(filtros: SaldoQueryDto, utilizador: any) {
    if (!filtros?.id) {
      return [];
    }
    if (utilizador?.role !== 'superadmin') {
      const balance = await this.balanceRepository.findOne({
        where: { id: filtros.id },
        relations: { event: true },
      });
      if (!balance || !balance.event?.id) {
        return [];
      }
      await this.membershipService.assertMember(utilizador, balance.event.id);
    }
    return this.movementRepository
      .createQueryBuilder('movimentacao')
      .where('movimentacao.balanceId = :id', { id: filtros.id })
      .orderBy('movimentacao.createdAt', 'ASC')
      .getMany();
  }

  async topProducts(filtros: TopProductsQueryDto, utilizador?: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

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

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.innerJoin('item.order', 'ordenEm').andWhere('ordenEm.' + scope.column, scope.params);
    }

    return query.getRawMany();
  }

  async obterEstatisticas(utilizador?: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contagem = (status: string, extra?: { sql: string; params: Record<string, unknown> }) => {
      const q = this.orderRepository
        .createQueryBuilder('orden')
        .where('orden.status = :status', { status });
      const scope = this.membershipService.eventColumnFor(eventIds);
      if (scope) {
        q.andWhere('orden.' + scope.column, scope.params);
      }
      if (extra) {
        q.andWhere(extra.sql, extra.params);
      }
      return q.getCount();
    };

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      contagem('received'),
      contagem('preparing'),
      contagem('ready'),
      contagem('delivered', { sql: 'orden.updatedAt >= :hoje', params: { hoje } }),
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
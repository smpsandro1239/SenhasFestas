import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, BalanceEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { sanitizarCelulaCsv } from '../../common/csv';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto, TotalQueryDto } from './dto';

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
    }

    if (filtros.station) {
      query.andWhere('orden.station = :station', { station: filtros.station });
    }

    const scope = this.membershipService.eventColumnFor(eventIds, filtros.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }

    if (filtros.from) {
      query.andWhere('orden.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros.to) {
      query.andWhere('orden.createdAt <= :ate', { ate: filtros.to });
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
          .map((item) => {
            const nome = sanitizarCelulaCsv(item.product?.name ?? item.productId ?? '');
            return `${item.quantity}x ${nome} (${item.subtotal})`;
          })
          .join(' | ');
      }
      const texto =
        valor === null || valor === undefined
          ? ''
          : typeof valor === 'object'
            ? JSON.stringify(valor)
            : String(valor);
      return `"${sanitizarCelulaCsv(texto).replace(/"/g, '""')}"`;
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
      .innerJoin('item.order', 'orden')
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.price', 'price')
      .addSelect('SUM(item.quantity)', 'totalVendido')
      .addSelect('SUM(item.subtotal)', 'receita')
      .where('orden.status != :cancelado', { cancelado: 'cancelled' })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.price')
      .orderBy('"totalVendido"', 'DESC')
      .limit(10);

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }
    if (filtros?.from) {
      query.andWhere('orden.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros?.to) {
      query.andWhere('orden.createdAt <= :ate', { ate: filtros.to });
    }

    const rows = await query.getRawMany();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      totalVendido: Number(row.totalVendido ?? 0),
      receita: Number(row.receita ?? 0),
    }));
  }

  async obterSeriesVendas(filtros: TotalQueryDto, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

    const query = this.orderRepository
      .createQueryBuilder('orden')
      .select("to_char(orden.createdAt, 'YYYY-MM-DD')", 'dia')
      .addSelect('COALESCE(SUM(orden.total), 0)', 'total')
      .addSelect('COUNT(orden.id)::int', 'pedidos')
      .where('orden.status != :cancelado', { cancelado: 'cancelled' })
      .groupBy('dia')
      .orderBy('dia', 'ASC');

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }
    if (filtros?.from) {
      query.andWhere('orden.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros?.to) {
      query.andWhere('orden.createdAt <= :ate', { ate: filtros.to });
    }

    return query.getRawMany();
  }

  async obterMetodosPagamento(filtros: TotalQueryDto, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

    const query = this.orderRepository
      .createQueryBuilder('orden')
      .select('orden.paymentMethod', 'metodo')
      .addSelect('COALESCE(SUM(orden.total), 0)', 'total')
      .addSelect('COUNT(orden.id)::int', 'pedidos')
      .where('orden.status != :cancelado', { cancelado: 'cancelled' })
      .groupBy('orden.paymentMethod')
      .orderBy('"total"', 'DESC');

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }
    if (filtros?.from) {
      query.andWhere('orden.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros?.to) {
      query.andWhere('orden.createdAt <= :ate', { ate: filtros.to });
    }

    return query.getRawMany();
  }

  async obterResumoMovimentos(filtros: TotalQueryDto, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

    const query = this.movementRepository
      .createQueryBuilder('movimentacao')
      .innerJoin('movimentacao.balance', 'saldo')
      .select('movimentacao.type', 'tipo')
      .addSelect('COALESCE(SUM(movimentacao.amount), 0)', 'total')
      .addSelect('COUNT(movimentacao.id)::int', 'quantidade')
      .groupBy('movimentacao.type')
      .orderBy('"total"', 'DESC');

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.andWhere('saldo.' + scope.column, scope.params);
    }
    if (filtros?.from) {
      query.andWhere('movimentacao.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros?.to) {
      query.andWhere('movimentacao.createdAt <= :ate', { ate: filtros.to });
    }

    return query.getRawMany();
  }

  async obterTotalVendas(filtros: TotalQueryDto, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);

    const query = this.orderRepository
      .createQueryBuilder('orden')
      .select('COALESCE(SUM(orden.total), 0)', 'total')
      .addSelect('COUNT(orden.id)', 'pedidos')
      .where('orden.status != :cancelado', { cancelado: 'cancelled' });

    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);
    if (scope) {
      query.andWhere('orden.' + scope.column, scope.params);
    }
    if (filtros?.from) {
      query.andWhere('orden.createdAt >= :desde', { desde: filtros.from });
    }
    if (filtros?.to) {
      query.andWhere('orden.createdAt <= :ate', { ate: filtros.to });
    }

    const linha = await query.getRawOne();
    return {
      total: Number(linha?.total ?? 0),
      pedidos: Number(linha?.pedidos ?? 0),
    };
  }

  async obterEstatisticas(filtros: TotalQueryDto, utilizador?: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const scope = this.membershipService.eventColumnFor(eventIds, filtros?.eventId);

    const contagem = (
      status: string,
      extra?: { sql: string; params: Record<string, unknown> },
      colunaData: 'createdAt' | 'updatedAt' = 'createdAt',
    ) => {
      const q = this.orderRepository
        .createQueryBuilder('orden')
        .where('orden.status = :status', { status });
      if (scope) {
        q.andWhere('orden.' + scope.column, scope.params);
      }
      if (filtros?.from) {
        q.andWhere(`orden.${colunaData} >= :desde`, { desde: filtros.from });
      }
      if (filtros?.to) {
        q.andWhere(`orden.${colunaData} <= :ate`, { ate: filtros.to });
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
      filtros?.from || filtros?.to
        ? contagem('delivered', undefined, 'updatedAt')
        : contagem('delivered', {
            sql: 'orden.updatedAt >= :hoje',
            params: { hoje: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() },
          }),
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
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity, BalanceEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { sanitizarCelulaCsv } from '../../common/csv';
import { saldoDeadlineUtc } from '../../common/balance-guard';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto, TotalQueryDto } from './dto';

const LIMITE_EXPORTACAO = 5000;
const DIA_MS = 86_400_000;

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

    // 'entregues' usa updatedAt (e nao o createdAt por omissao) para bater certo com
    // o KDS. Sem coluna deliveredAt, updatedAt e o melhor proxy do instante da
    // entrega. Ver o comentario completo em kitchen.service.ts e o teste
    // modules/entregues-consistencia.spec.ts.
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

  async obterBalancesPorEvento(filters: any, utilizador: any) {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const scope = this.membershipService.eventColumnFor(eventIds, filters?.eventId);
    const query = this.movementRepository
      .createQueryBuilder('movimentacao')
      .leftJoin('movimentacao.balance', 'saldo')
      .leftJoinAndSelect('saldo.user', 'usuario')
      .select('saldo.userId', 'userId')
      .addSelect('usuario.name', 'name')
      .addSelect('usuario.email', 'email')
      .addSelect('usuario.phone', 'phone')
      .addSelect('movimentacao.type', 'tipo')
      .addSelect('COALESCE(SUM(movimentacao.amount), 0)', 'total')
      .addSelect('COUNT(movimentacao.id)::int', 'qty')
      .groupBy('saldo.userId')
      .addGroupBy('usuario.name')
      .addGroupBy('usuario.email')
      .addGroupBy('usuario.phone')
      .addGroupBy('movimentacao.type')
      .orderBy('usuario.name', 'ASC');
    if (filters?.eventId) {
      query.andWhere('saldo.eventId = :eventId', { eventId: filters.eventId });
    } else if (scope) {
      query.andWhere('saldo.' + scope.column, scope.params);
    }
    if (filters?.from) {
      query.andWhere('movimentacao.createdAt >= :desde', { desde: filters.from });
    }
    if (filters?.to) {
      query.andWhere('movimentacao.createdAt <= :ate', { ate: filters.to });
    }
    if (filters?.type) {
      query.andWhere('movimentacao.type = :tipoMov', { tipoMov: filters.type });
    }
    if (filters?.operator) {
      query.andWhere('movimentacao.createdById = :operador', { operador: filters.operator });
    }
    if (filters?.q) {
      const q = '%' + filters.q + '%';
      query.andWhere('(LOWER(usuario.name) LIKE LOWER(:q) OR LOWER(usuario.email) LIKE LOWER(:q) OR usuario.phone LIKE :q)', { q });
    }
    const raw = await query.getRawMany();
    const countMov = (await (query as any).getCount?.()) ?? raw.length;
    const map = new Map<string, any>();
    for (const r of raw) {
      const key = r.userId;
      if (!map.has(key)) {
        map.set(key, { userId: r.userId, name: r.name ?? 'Cliente', email: r.email, phone: r.phone, loadedGross: 0, loadedNet: 0, consumedGross: 0, consumedNet: 0, movementCount: 0 });
      }
      const item = map.get(key);
      const total = parseFloat(r.total) || 0;
      const tipo = r.tipo;
      if (tipo === 'load') item.loadedGross += total;
      if (tipo === 'cancel') item.loadedNet -= total;
      if (tipo === 'consume') item.consumedGross += total;
      if (tipo === 'refund') item.consumedNet -= total;
      item.movementCount = (item.movementCount ?? 0) + (Number(r.qty) || 0);
    }
    for (const item of map.values()) {
      item.loadedNet = item.loadedGross + item.loadedNet;
      item.consumedNet = item.consumedGross + item.consumedNet;
      if (item.loadedNet < 0) item.loadedNet = 0;
      if (item.consumedNet < 0) item.consumedNet = 0;
    }
    const items = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let loadedGross = 0, loadedNet = 0, consumedGross = 0, consumedNet = 0;
    for (const r of raw) {
      const total = parseFloat(r.total) || 0;
      const tipo = r.tipo;
      if (tipo === 'load') loadedGross += total;
      if (tipo === 'cancel') loadedNet -= total;
      if (tipo === 'consume') consumedGross += total;
      if (tipo === 'refund') consumedNet -= total;
    }
    loadedNet = loadedGross + loadedNet;
    consumedNet = consumedGross + consumedNet;
    if (loadedNet < 0) loadedNet = 0;
    if (consumedNet < 0) consumedNet = 0;
    return { eventId: filters?.eventId, items, totals: { loadedGross, loadedNet, consumedGross, consumedNet }, movementCount: countMov };
  }

  /**
   * Saldos com prazo a vencer dentro de `dias`, agrupados por evento
   * (secção/popup "Saldos a expirar"). O prazo não é calculável em SQL
   * (fuso Europe/Lisbon) — a filtragem final é feita em memória.
   */
  async obterSaldosAExpirar(
    filters: { dias?: number; limiteEventos?: number; eventId?: string } | undefined,
    utilizador: any,
    now: Date = new Date(),
  ) {
    const dias =
      Number.isFinite(filters?.dias) && (filters as any).dias >= 1
        ? Math.min((filters as any).dias, 60)
        : 7;
    const limiteEventos =
      Number.isFinite(filters?.limiteEventos) && (filters as any).limiteEventos >= 1
        ? Math.min((filters as any).limiteEventos, 20)
        : 5;

    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const scope = this.membershipService.eventColumnFor(eventIds, filters?.eventId);

    // Prazo futuro implica endDate >= agora - (grace máx. 60d + 1d da janela),
    // a menos que exista extensão manual.
    const cutoff = new Date(now.getTime() - 62 * DIA_MS);
    const query = this.balanceRepository
      .createQueryBuilder('saldo')
      .leftJoinAndSelect('saldo.event', 'evento')
      .leftJoinAndSelect('saldo.user', 'usuario')
      .where('saldo.archivedAt IS NULL')
      .andWhere('saldo.currentBalance > 0')
      .andWhere('(evento.endDate IS NULL OR evento.endDate >= :cutoff OR saldo.extendedUntil >= :agora)', {
        cutoff,
        agora: now,
      });
    if (scope) {
      if (String(scope.column).includes('IN')) {
        query.andWhere('saldo.eventId IN (:...scopeEventIds)', scope.params);
      } else {
        query.andWhere('saldo.' + scope.column, scope.params);
      }
    }
    const rows = await query.getMany();

    const fim = now.getTime() + dias * DIA_MS;
    const porEvento = new Map<string, any>();
    for (const saldo of rows) {
      if (saldo.archivedAt || Number(saldo.currentBalance) <= 0 || !saldo.event?.id) {
        continue;
      }
      const deadline = saldoDeadlineUtc(saldo.event, saldo.extendedUntil);
      if (!deadline) {
        continue;
      }
      const t = deadline.getTime();
      if (t < now.getTime() || t > fim) {
        continue;
      }
      let item = porEvento.get(saldo.event.id);
      if (!item) {
        item = {
          eventId: saldo.event.id,
          nome: saldo.event.name,
          endDate: saldo.event.endDate,
          deadline: deadline.toISOString(),
          diasRestantes: Math.max(0, Math.ceil((t - now.getTime()) / DIA_MS)),
          clientes: 0,
          total: 0,
          _usuarios: new Set<string>(),
        };
        porEvento.set(saldo.event.id, item);
      }
      const userId = saldo.user?.id;
      if (userId && !item._usuarios.has(userId)) {
        item._usuarios.add(userId);
        item.clientes += 1;
      }
      item.total += Number(saldo.currentBalance) || 0;
    }

    const eventos = Array.from(porEvento.values())
      .map(({ _usuarios, ...item }) => ({ ...item, total: Math.round(item.total * 100) / 100 }))
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, limiteEventos);

    return {
      dias,
      agora: now.toISOString(),
      eventos,
      totalClientes: eventos.reduce((s, e) => s + e.clientes, 0),
      total: Math.round(eventos.reduce((s, e) => s + e.total, 0) * 100) / 100,
    };
  }

}
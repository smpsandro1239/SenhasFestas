import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceEntity, BalanceMovementEntity, ProductEntity, EventEntity, EventUserEntity } from '../../entities';
import { CreateOrderDto } from './dto';
import { QRCodeService } from '../../services/qr-code.service';
import { OrderGateway } from '../../websocket/order.gateway';
import { NotificationService } from '../../services/notification.service';
import { MovementType } from '../../entities';
import { centavos, subtrai } from '../../common/money';
import { reembolsarSaldoEmTransacao, temSaldoParaReembolsar } from '../../common/order-refund';
import { assertPodeMexerEmSaldo, assertSaldoUtilizavel } from '../../common/balance-guard';
import { reporStockEmTransacao } from '../../common/order-stock';
import { EventService } from '../event/event.service';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly movementRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly qrCodeService: QRCodeService,
    private readonly orderGateway: OrderGateway,
    private readonly notificationService: NotificationService,
    private readonly eventService: EventService,
  ) {}

  async create(user: any, dto: CreateOrderDto, rawIdempotencyKey?: string): Promise<any> {
    const idempotencyKey = this.validarChaveIdempotencia(rawIdempotencyKey);
    const requestHash = idempotencyKey ? this.hashPedido(user.id, dto) : undefined;
    const event = await this.eventRepository.findOne({ where: { id: dto.eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const isMember = await this.eventUserRepository.findOne({
      where: { event: { id: event.id }, user: { id: user.id } },
    });
    if (!isMember && user.role !== 'superadmin') {
      throw new ForbiddenException('Não pertence a este evento');
    }

    // Um retry confirmado devolve o pedido original mesmo depois do fecho
    // operacional do evento; não volta a debitar saldo nem a baixar stock.
    if (idempotencyKey) {
      const existente = await this.buscarPedidoIdempotente(event.id, user.id, idempotencyKey);
      if (existente) {
        this.assertHashPedido(existente, requestHash!);
        return this.finalizarCriacao(existente, event.id, true);
      }
    }

    if (!idempotencyKey) {
      await this.eventService.assertEventOperavel(event);
    }

    let savedOrder: OrderEntity;
    let replayed = false;
    try {
      savedOrder = await this.dataSource.transaction(async (manager) => {
        if (idempotencyKey) {
          // Serializa a mesma chave no PostgreSQL. Um retry concorrente só
          // consulta o pedido vencedor depois de a primeira transação terminar.
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
            [`${event.id}:${user.id}`, idempotencyKey],
          );
          const existente = await manager.findOne(OrderEntity, {
            where: { event: { id: event.id }, createdById: user.id, idempotencyKey },
          });
          if (existente) {
            this.assertHashPedido(existente, requestHash!);
            replayed = true;
            return existente;
          }
          await this.eventService.assertEventOperavel(event);
        }

        const productIds = [...new Set(dto.items.map((item) => item.productId))];
        const products = productIds.length
          ? await manager.find(ProductEntity, {
              where: { id: In(productIds) },
              relations: { event: true },
            })
          : [];
        if (products.length !== productIds.length) {
          throw new NotFoundException('Um ou mais produtos não encontrados');
        }
        const productById = new Map(products.map((product) => [product.id, product]));

        // Relock só os produtos com controlo de stock (stock != null). O read
        // inicial não é seguro para vender: duas encomendas concorrentes podiam
        // ler o mesmo número e vender a mesma unidade. O lock pessimista
        // serializa a venda e devolve o valor atual, que é o usado para validar
        // e para decrementar.
        const trackedIds = productIds
          .map((productId) => productById.get(productId))
          .filter((product) => product?.stock != null)
          .map((product) => product!.id);
        const lockedById = new Map<string, ProductEntity>();
        if (trackedIds.length > 0) {
          const locked = await manager.find(ProductEntity, {
            where: { id: In(trackedIds) },
            // Todas as transações bloqueiam produtos pela mesma ordem,
            // independentemente da ordem dos artigos enviada pelo cliente.
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
          });
          for (const product of locked) {
            lockedById.set(product.id, product);
          }
          if (lockedById.size !== trackedIds.length) {
            throw new NotFoundException('Um ou mais produtos deixaram de estar disponíveis');
          }
        }

        const quantityByProductId = new Map<string, number>();
        for (const item of dto.items) {
          quantityByProductId.set(
            item.productId,
            (quantityByProductId.get(item.productId) ?? 0) + item.quantity,
          );
        }

        let total = 0;
        for (const item of dto.items) {
          const product = productById.get(item.productId);
          if (!product) {
            throw new NotFoundException(`Produto não encontrado: ${item.productId}`);
          }
          if (product.event?.id !== event.id) {
            throw new BadRequestException(`Produto indisponível neste evento: ${item.productId}`);
          }
          if (!product.isActive) {
            throw new BadRequestException(`Produto indisponível: ${item.productId}`);
          }
          total = centavos(total + item.quantity * centavos(Number(product.price)));
        }

        for (const [productId, quantity] of quantityByProductId) {
          const product = productById.get(productId)!;
          const locked = lockedById.get(productId);
          const stock = locked ? locked.stock : product.stock;
          if (stock != null && quantity > Number(stock)) {
            throw new BadRequestException(`Stock insuficiente para: ${productId}`);
          }
        }

        const balanceUsed = centavos(Math.min(dto.balanceUsed || 0, total));
        if (balanceUsed > 0 && !dto.balanceId) {
          throw new ForbiddenException('Usar saldo requer balanceId');
        }
        if (dto.paymentMethod === 'balance') {
          if (!dto.balanceId) {
            throw new ForbiddenException('Pagamento com saldo requer balanceId');
          }
          if (balanceUsed < total) {
            throw new ForbiddenException('Saldo insuficiente para cobrir o pedido');
          }
        }
        const order = manager.create(OrderEntity, {
          source: dto.source,
          event,
          status: 'received',
          tableNumber: dto.tableNumber,
          station: dto.station,
          balanceId: dto.balanceId,
          paymentMethod: dto.paymentMethod,
          total,
          balanceUsed,
          createdById: user.id,
          idempotencyKey,
          requestHash,
        });
        const createdOrder = await manager.save(OrderEntity, order);

        for (const item of dto.items) {
          const product = productById.get(item.productId);
          const unitPrice = centavos(Number(product.price));
          const orderItem = manager.create(OrderItemEntity, {
            order: createdOrder,
            product,
            quantity: item.quantity,
            unitPrice,
            subtotal: centavos(item.quantity * unitPrice),
            notes: item.notes,
          });
          await manager.save(OrderItemEntity, orderItem);
        }

        // Decrementar o stock só nos produtos com controlo (stock != null).
        // Quem não tem controlo (menu aberto) fica intocável.
        for (const [productId, quantity] of quantityByProductId) {
          const locked = lockedById.get(productId);
          if (locked?.stock != null) {
            locked.stock = Number(locked.stock) - quantity;
            await manager.save(ProductEntity, locked);
          }
        }

        if (dto.balanceId && balanceUsed > 0) {
          await this.consumeBalanceInTransaction(manager, user, dto.balanceId, balanceUsed, createdOrder.id, event.id);
        }

        return createdOrder;
      });
    } catch (error) {
      // A restrição UNIQUE parcial arbitra retries concorrentes. Depois do
      // rollback, a segunda chamada recupera o pedido vencedor.
      if (idempotencyKey && this.ehViolacaoUnica(error)) {
        const existente = await this.buscarPedidoIdempotente(event.id, user.id, idempotencyKey);
        if (existente) {
          this.assertHashPedido(existente, requestHash!);
          return this.finalizarCriacao(existente, event.id, true);
        }
      }
      throw error;
    }

    return this.finalizarCriacao(savedOrder, event.id, replayed);
  }

  private validarChaveIdempotencia(value?: string): string | undefined {
    if (value === undefined) return undefined;
    const key = value.trim();
    if (key.length < 8 || key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) {
      throw new BadRequestException('Idempotency-Key inválida (8 a 128 caracteres ASCII visíveis)');
    }
    return key;
  }

  private hashPedido(userId: string, dto: CreateOrderDto): string {
    const payload = {
      userId,
      eventId: dto.eventId,
      source: dto.source,
      tableNumber: dto.tableNumber ?? null,
      station: dto.station ?? null,
      balanceId: dto.balanceId ?? null,
      paymentMethod: dto.paymentMethod ?? 'balance',
      balanceUsed: centavos(dto.balanceUsed ?? 0),
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes ?? null,
      })),
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async buscarPedidoIdempotente(
    eventId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { event: { id: eventId }, createdById: userId, idempotencyKey },
    });
  }

  private assertHashPedido(order: OrderEntity, requestHash: string): void {
    if (!order.requestHash || order.requestHash !== requestHash) {
      throw new ConflictException('Idempotency-Key já utilizada com outro conteúdo');
    }
  }

  private ehViolacaoUnica(error: unknown): boolean {
    const err = error as {
      code?: string;
      constraint?: string;
      driverError?: { code?: string; constraint?: string };
    };
    const driverError = err?.driverError ?? err;
    return (
      driverError?.code === '23505' &&
      driverError?.constraint === 'UQ_orders_idempotency'
    );
  }

  private async finalizarCriacao(
    savedOrder: OrderEntity,
    eventId: string,
    replayed: boolean,
  ): Promise<any> {
    // O evento de estado pode ser repetido sem efeitos financeiros. Se a
    // primeira resposta falhou depois do commit, o retry volta a acordar o POS/KDS.
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status, eventId);
    const qrCode = await this.qrCodeService.generateOrderQRCode(savedOrder.id);
    if (!replayed) {
      await this.notificationService.notifyNewOrder(savedOrder.id);
    }
    const result = await this.findOne(savedOrder.id);
    return { ...result, qrCode };
  }

  private async consumeBalanceInTransaction(
    manager: import('typeorm').EntityManager,
    user: any,
    balanceId: string,
    amount: number,
    orderId: string,
    eventId: string,
  ): Promise<void> {
    assertPodeMexerEmSaldo(user);
    const balanceCtx = await manager.findOne(BalanceEntity, {
      where: { id: balanceId },
      relations: { user: true, event: true },
    });
    if (!balanceCtx) {
      throw new NotFoundException('Saldo não encontrado');
    }
    const isClient = user?.role === 'client';
    if (isClient && balanceCtx.user?.id !== user.id) {
      throw new ForbiddenException('Não pode usar o saldo de outro utilizador');
    }
    // Saldos são sempre scoped por evento. Um saldo legado sem eventId não
    // pode ser consumido em qualquer evento (nem contornar a separação de caixa).
    if (!balanceCtx.event?.id || balanceCtx.event.id !== eventId) {
      throw new ForbiddenException('Saldo não pertence a este evento ou não tem evento associado');
    }

    const balance = await manager.findOne(BalanceEntity, {
      where: { id: balanceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      throw new NotFoundException('Saldo não encontrado');
    }
    assertSaldoUtilizavel({
      archivedAt: balance.archivedAt,
      extendedUntil: balance.extendedUntil,
      event: balanceCtx.event,
    });
    if (centavos(Number(balance.currentBalance)) < centavos(amount)) {
      throw new ForbiddenException('Saldo insuficiente');
    }

    const updated = await manager.update(
      BalanceEntity,
      { id: balanceId, currentBalance: balance.currentBalance },
      { currentBalance: subtrai(Number(balance.currentBalance), centavos(amount)) },
    );
    if (!updated.affected) {
      throw new ForbiddenException('Saldo alterado, tente novamente');
    }

    const movement = manager.create(BalanceMovementEntity, {
      balance: { id: balanceId } as any,
      type: MovementType.CONSUME,
      amount,
      orderId,
    });
    await manager.save(BalanceMovementEntity, movement);
  }

  // Reposição de stock em cancelamentos vive em common/order-stock.ts e é
  // partilhada com a kitchen: reverter a venda tem de devolver as unidades
  // seja qual for o ponto de cancelamento.
  async findByEvent(eventId: string, user: any): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (user && user.role !== 'superadmin') {
      const membership = await this.eventUserRepository.findOne({
        where: { event: { id: eventId }, user: { id: user.id } },
      });
      if (!membership) {
        throw new ForbiddenException('Não pertence a este evento');
      }
    }
    return this.findAll(eventId);
  }

  async findAll(eventId?: string, balanceIds?: string[], eventIds?: string[], page = 1, limit = 20): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (balanceIds && balanceIds.length > 0) {
      query.where('order.balanceId IN (:...balanceIds)', { balanceIds });
    } else if (balanceIds) {
      return { items: [], total: 0, page, limit };
    }

    if (eventId) {
      query.andWhere('order.event.id = :eventId', { eventId });
    }

    if (eventIds && eventIds.length > 0) {
      query.andWhere('order.event.id IN (:...eventIds)', { eventIds });
    }

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async findAllForUser(user: any, page = 1, limit = 20): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (user.role === 'client') {
      const balances = await this.balanceRepository.find({
        where: { user: { id: user.id } as any },
      });
      return this.findAll(undefined, balances.map((b) => b.id), undefined, page, limit);
    }
    if (user.role === 'superadmin') {
      return this.findAll(undefined, undefined, undefined, page, limit);
    }
    const memberships = await this.eventUserRepository.find({
      where: { user: { id: user.id } as any },
      relations: { event: true },
    });
    const eventIds = memberships.map((m) => m.event?.id).filter((id): id is string => Boolean(id));
    if (eventIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    return this.findAll(undefined, undefined, eventIds, page, limit);
  }

  async findOne(id: string): Promise<any> {
    return this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.id = :id', { id })
      .getOne();
  }

  async cancelOrder(
    id: string,
    user: any,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<any> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (!['received', 'preparing'].includes(order.status)) {
      throw new ForbiddenException('Pedido não pode ser cancelado neste estado');
    }

    const isStaff = user?.role !== 'client';
    if (!isStaff) {
      if (!order.balanceId) {
        throw new ForbiddenException('Não pode cancelar este pedido');
      }
      const balance = await this.balanceRepository.findOne({
        where: { id: order.balanceId },
        relations: { user: true },
        withDeleted: true,
      });
      if (!balance || balance.user?.id !== user.id) {
        throw new ForbiddenException('Não pode cancelar o pedido de outro utilizador');
      }
    } else if (user?.role !== 'superadmin') {
      const membership = await this.eventUserRepository.findOne({
        where: { event: { id: order.event?.id }, user: { id: user.id } },
      });
      if (!membership) {
        throw new ForbiddenException('Não pertence a este evento');
      }
    }

    arquivar?.({ antes: { status: order.status }, eventId: order.event?.id });

    const savedOrder = await this.dataSource.transaction(async (manager) => {
      const currentOrder = await manager.findOne(OrderEntity, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currentOrder) {
        throw new NotFoundException('Pedido não encontrado');
      }
      if (!['received', 'preparing'].includes(currentOrder.status)) {
        throw new ForbiddenException('Pedido não pode ser cancelado neste estado');
      }

      // Revalidar autorização depois de bloquear o pedido fecha a janela
      // entre a verificação inicial e a escrita financeira/stock.
      if (user?.role === 'client') {
        const balance = currentOrder.balanceId
          ? await manager.findOne(BalanceEntity, {
              where: { id: currentOrder.balanceId, user: { id: user.id } },
              lock: { mode: 'pessimistic_write' },
              withDeleted: true,
            })
          : null;
        if (!balance || balance.user?.id !== user.id) {
          throw new ForbiddenException('Não pode cancelar o pedido de outro utilizador');
        }
      } else if (user?.role !== 'superadmin') {
        const membership = await manager.findOne(EventUserEntity, {
          where: { event: { id: order.event?.id }, user: { id: user?.id } },
          lock: { mode: 'pessimistic_read' },
        });
        if (!membership) {
          throw new ForbiddenException('Não pertence a este evento');
        }
      }

      if (temSaldoParaReembolsar(currentOrder)) {
        assertPodeMexerEmSaldo(user);
      }

      currentOrder.status = 'cancelled';
      const updatedOrder = await manager.save(OrderEntity, currentOrder);

      await reembolsarSaldoEmTransacao(manager, currentOrder, user?.id);
      await reporStockEmTransacao(manager, currentOrder.id);

      return updatedOrder;
    });

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, savedOrder.status, order.event?.id);

    return savedOrder;
  }

  async updateStatus(
    id: string,
    status: string,
    user?: any,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<any> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (user && user.role !== 'superadmin') {
      const membership = await this.eventUserRepository.findOne({
        where: { event: { id: order.event?.id }, user: { id: user.id } },
      });
      if (!membership) {
        throw new ForbiddenException('Não pertence a este evento');
      }
    }

    const transicoesValidas: Record<string, string[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (!transicoesValidas[order.status]?.includes(status)) {
      throw new ForbiddenException(`Transição inválida: ${order.status} -> ${status}`);
    }

    arquivar?.({ antes: { status: order.status }, eventId: order.event?.id });

    const savedOrder = await this.dataSource.transaction(async (manager) => {
      const currentOrder = await manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currentOrder || currentOrder.status !== order.status) {
        throw new ForbiddenException('Pedido mudou de estado, tente novamente');
      }
      if (user && user.role !== 'superadmin') {
        const membership = await manager.findOne(EventUserEntity, {
          where: { event: { id: order.event?.id }, user: { id: user.id } },
          lock: { mode: 'pessimistic_read' },
        });
        if (!membership) {
          throw new ForbiddenException('Não pertence a este evento');
        }
      }
      if (status === 'cancelled' && temSaldoParaReembolsar(currentOrder)) {
        assertPodeMexerEmSaldo(user);
      }
      currentOrder.status = status as 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
      const updated = await manager.save(OrderEntity, currentOrder);

      if (status === 'cancelled') {
        if (temSaldoParaReembolsar(currentOrder)) {
          assertPodeMexerEmSaldo(user);
        }
        await reembolsarSaldoEmTransacao(manager, currentOrder, user?.id);
        await reporStockEmTransacao(manager, currentOrder.id);
      }

      return updated;
    });

    // Send notification based on new status
    switch (status) {
      case 'preparing':
        await this.notificationService.notifyOrderPrepared(savedOrder.id);
        break;
      case 'ready':
        await this.notificationService.notifyOrderReady(savedOrder.id);
        break;
      case 'delivered':
        await this.notificationService.notifyOrderDelivered(savedOrder.id);
        break;
      default:
        break;
    }

    // Also emit WebSocket event for real-time updates
    this.orderGateway.emitOrderUpdate(savedOrder.id, status, order.event?.id);

    return savedOrder;
  }
}

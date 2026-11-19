import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, ILike, Repository } from 'typeorm';
import { ProductEntity, CategoryEntity, UserEntity, EventEntity, EventUserEntity, OrderItemEntity } from '../../entities';
import { MANAGEMENT_ROLES } from '../../common/roles';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from './dto';
import { MembershipService } from '../../common/membership.service';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    private readonly membershipService: MembershipService,
  ) {}

  private async assertManagementMembershipInTransaction(
    manager: EntityManager,
    user: UserEntity,
    eventId: string,
  ): Promise<void> {
    if (user?.role === 'superadmin') return;
    if (!user?.id) {
      throw new ForbiddenException('Não autenticado');
    }
    const membership = await manager.findOne(EventUserEntity, {
      where: { event: { id: eventId }, user: { id: user.id } },
      lock: { mode: 'pessimistic_read' },
    });
    if (!membership) {
      throw new ForbiddenException('Não pertence a este evento');
    }
    if (!MANAGEMENT_ROLES.includes(membership.role)) {
      throw new ForbiddenException('A tua função neste evento não permite gerir o catálogo');
    }
  }

  async findAll(
    eventId?: string,
    page = 1,
    limit = 20,
    filters: {
      q?: string;
      categoryId?: string;
      availability?: string;
      includeInactive?: boolean;
    } = {},
    eventIds?: string[],
  ): Promise<{ items: ProductEntity[]; total: number; page: number; limit: number }> {
    // Sem includeInactive ficam so os ativos — este é o default que POS e QR
    // usam. Quem pede includeInactive recebe ativos e inativos, não só os
    // inativos.
    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) {
      where.isActive = true;
    }
    if (eventId) {
      where.event = { id: eventId };
    } else if (eventIds !== undefined) {
      if (eventIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      where.event = { id: In(eventIds) };
    }
    if (filters.q?.trim()) {
      where.name = ILike(`%${filters.q.trim()}%`);
    }
    if (filters.categoryId) {
      where.category = { id: filters.categoryId };
    }
    if (filters.availability) {
      where.availability = filters.availability;
    }
    const [items, total] = await this.productRepository.findAndCount({
      where,
      relations: { category: true, event: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, limit };
  }

  async findSuggestions(
    user: UserEntity,
    eventId: string | undefined,
    productId: string,
    limit = 4,
  ): Promise<{ items: ProductEntity[]; source: 'cooccurrence' | 'category' | 'popular' }> {
    const target = await this.productRepository.findOne({
      where: { id: productId },
      relations: { category: true, event: true },
    });
    if (!target) {
      throw new NotFoundException('Produto não encontrado');
    }
    const escopoEvento = eventId ?? target.event?.id;
    if (escopoEvento) {
      await this.membershipService.assertMember(user, escopoEvento);
    }

    // 1. Data-driven: aggregate co-occurrence in PostgreSQL.
    // Avoid loading every order and every related product into Node.js memory.
    const query = this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'purchase')
      .innerJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .where('purchase.status IN (:...statuses)', {
        statuses: ['received', 'preparing', 'ready', 'delivered'],
      })
      .andWhere(
        'purchase.id IN (SELECT target_item."orderId" FROM order_items target_item WHERE target_item."productId" = :targetProductId)',
        { targetProductId: productId },
      )
      .andWhere('product.id <> :productId', { productId })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .andWhere('product.deletedAt IS NULL');

    if (escopoEvento) {
      query.andWhere('purchase.eventId = :eventId', { eventId: escopoEvento });
    }

    const cooccurrence = await query
      .groupBy('product.id')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('product.id', 'ASC')
      .limit(Math.max(0, limit))
      .getRawMany<{ productId: string; totalQuantity: string }>();

    if (cooccurrence.length > 0) {
      const rankedIds = cooccurrence.map((row) => row.productId);
      const items = await this.fetchByIds(rankedIds);
      if (items.length > 0) {
        return { items, source: 'cooccurrence' };
      }
    }

    // 2. Fallback: same-category products (exclude self), most recent first.
    if (target.category?.id) {
      const sameCategory = await this.productRepository.find({
        where: {
          category: { id: target.category.id },
          isActive: true,
          ...(escopoEvento ? { event: { id: escopoEvento } } : {}),
        },
        relations: { category: true },
        take: limit + 1,
        order: { createdAt: 'DESC' },
      });
      const items = sameCategory.filter((p) => p.id !== productId).slice(0, limit);
      if (items.length > 0) {
        return { items, source: 'category' };
      }
    }

    // 3. Fallback: most popular products of the event.
    const wherePopular: Record<string, unknown> = { isActive: true };
    if (escopoEvento) {
      wherePopular.event = { id: escopoEvento };
    }
    const popular = await this.productRepository.find({
      where: wherePopular,
      relations: { category: true },
      take: limit + 1,
      order: { stock: 'DESC' },
    });
    const items = popular.filter((p) => p.id !== productId).slice(0, limit);
    return { items, source: 'popular' };
  }

  private async fetchByIds(ids: string[]): Promise<ProductEntity[]> {
    if (ids.length === 0) return [];
    const products = await this.productRepository.find({
      where: { id: In(ids), isActive: true },
      relations: { category: true },
    });
    // SQL order is the recommendation score order; IN() does not preserve it.
    const byId = new Map(products.map((product) => [product.id, product]));
    return ids.map((id) => byId.get(id)).filter((product): product is ProductEntity => !!product);
  }

  async findOne(id: string, user: UserEntity): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.event?.id && user?.role !== 'superadmin') {
      await this.membershipService.assertMember(user, product.event.id);
    }
    return product;
  }

  async create(user: UserEntity, dto: CreateProductDto): Promise<ProductEntity> {
    const criarProduto = (event?: EventEntity) =>
      this.productRepository.create({
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        availability: dto.availability,
        kitchenName: dto.kitchenName,
        category: dto.categoryId ? ({ id: dto.categoryId } as any) : undefined,
        stock: dto.stock,
        isActive: true,
        ...(event ? { event } : {}),
      });

    if (!dto.eventId) {
      return this.productRepository.save(criarProduto());
    }

    return this.productRepository.manager.transaction(async (manager) => {
      // A role actual é bloqueada na mesma transacção da criação. A role do
      // JWT/guard pode ter ficado desactualizada após um downgrade concorrente.
      await this.assertManagementMembershipInTransaction(manager, user, dto.eventId!);
      const event = await manager.findOne(EventEntity, { where: { id: dto.eventId } });
      if (!event) {
        throw new NotFoundException('Evento não encontrado');
      }
      return manager.save(ProductEntity, criarProduto(event));
    });
  }

  async update(
    id: string,
    user: UserEntity,
    dto: UpdateProductDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<ProductEntity> {
    return this.productRepository.manager.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, {
        where: { id },
        relations: { event: true, category: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');
      if (product.event?.id) {
        await this.assertManagementMembershipInTransaction(manager, user, product.event.id);
      }
      const { event, ...camposProduto } = product;
      arquivar?.({ antes: camposProduto, eventId: event?.id });
      const { categoryId, ...rest } = dto;
      Object.assign(product, rest);
      if (categoryId !== undefined) {
        product.category = categoryId === null ? null : ({ id: categoryId } as CategoryEntity);
      }
      return manager.save(ProductEntity, product);
    });
  }

  // Reabastecimento rápido (+N) e acerto de stock físico (novoValor). O delta
  // usa lock pessimista para não colidir com os decrementos dos pedidos; o
  // acerto arquiva o motivo para reconciliar diferenças no fim da festa.
  async ajustarStock(
    id: string,
    user: UserEntity,
    dto: AdjustStockDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<ProductEntity> {
    const temDelta = dto.delta !== undefined;
    const temNovoValor = dto.novoValor !== undefined;
    if (temDelta === temNovoValor) {
      throw new BadRequestException('Indique delta ou novoValor (não ambos)');
    }
    if (temDelta && dto.delta === 0) {
      throw new BadRequestException('Delta tem de ser diferente de zero');
    }

    const resultado = await this.productRepository.manager.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, {
        where: { id },
        relations: { event: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }
      if (product.event?.id && user?.role !== 'superadmin') {
        // O lock partilhado com alterações de membership impede que um
        // downgrade/removal concorrente passe entre a autorização e a escrita.
        const membership = await manager.findOne(EventUserEntity, {
          where: { event: { id: product.event.id }, user: { id: user?.id } },
          lock: { mode: 'pessimistic_read' },
        });
        if (!membership) {
          throw new ForbiddenException('Não pertence a este evento');
        }
        if (!MANAGEMENT_ROLES.includes(membership.role)) {
          throw new ForbiddenException('A tua função neste evento não permite gerir o catálogo');
        }
      }

      const antes = product.stock ?? null;
      arquivar?.({
        antes: { stock: antes },
        eventId: product.event?.id,
        extras: {
          delta: temDelta ? dto.delta : undefined,
          novoValor: temNovoValor ? dto.novoValor : undefined,
          motivo: dto.motivo,
        },
      });
      if (temDelta) {
        if (product.stock == null) {
          throw new BadRequestException('Produto sem controlo de stock (reabastecer exige stock definido)');
        }
        product.stock = Math.max(0, Number(product.stock) + dto.delta!);
      } else {
        product.stock = dto.novoValor!;
      }
      const salvo = await manager.save(ProductEntity, product);

      return salvo;
    });

    return resultado;
  }

  // "Bifana (cópia)" e "Bifana (cópia 2)" reduzem ambos a "Bifana".
  private static readonly SUFIXO_COPIA = /^(.*?)\s*\(cópia(?:\s+\d+)?\)\s*$/;

  async duplicate(id: string, user: UserEntity): Promise<ProductEntity> {
    return this.productRepository.manager.transaction(async (manager) => {
      const source = await manager.findOne(ProductEntity, {
        where: { id },
        relations: { event: true, category: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!source) throw new NotFoundException('Produto não encontrado');
      if (source.event?.id) {
        await this.assertManagementMembershipInTransaction(manager, user, source.event.id);
      }
      const base = (CatalogService.SUFIXO_COPIA.exec(source.name)?.[1] ?? source.name).trim() || source.name;
      const existentes = await manager.find(ProductEntity, {
        where: {
          ...(source.event?.id ? { event: { id: source.event.id } } : {}),
          name: ILike(escaparLike(base) + ' (cópia%'),
        },
      });
      const padrao = new RegExp('^' + escaparRegExp(base) + ' \\(cópia(?: (\\d+))?\\)$', 'i');
      let maior = 0;
      for (const p of existentes) {
        const m = padrao.exec(p.name ?? '');
        if (!m) continue;
        const n = m[1] ? Number.parseInt(m[1], 10) : 1;
        if (Number.isFinite(n)) maior = Math.max(maior, n);
      }
      const sufixo = maior === 0 ? ' (cópia)' : ' (cópia ' + (maior + 1) + ')';
      const copy = manager.create(ProductEntity, {
        name: base + sufixo,
        description: source.description,
        imageUrl: source.imageUrl,
        price: source.price,
        availability: source.availability,
        stock: 0,
        isActive: false,
        category: source.category ? ({ id: source.category.id } as any) : undefined,
        ...(source.event?.id ? { event: { id: source.event.id } as any } : {}),
        options: source.options ? { ...source.options } : undefined,
        modifiers: source.modifiers ? { ...source.modifiers } : undefined,
        kitchenName: source.kitchenName,
      });
      return manager.save(ProductEntity, copy);
    });
  }

  async findCategories(eventIds?: string[]): Promise<CategoryEntity[]> {
    if (eventIds !== undefined && eventIds.length === 0) {
      return [];
    }
    return this.categoryRepository.find({
      where: {
        isActive: true,
        ...(eventIds !== undefined ? { event: { id: In(eventIds) } } : {}),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }


  async importProducts(
    user: UserEntity,
    sourceEventId: string,
    targetEventId: string,
    productIds?: string[],
  ): Promise<{ importedCount: number; products: ProductEntity[] }> {
    return this.productRepository.manager.transaction(async (manager) => {
      if (user?.role !== 'superadmin') {
        // Ordem estável para evitar deadlocks em importações cruzadas.
        for (const eventId of [...new Set([sourceEventId, targetEventId])].sort()) {
          await this.assertManagementMembershipInTransaction(manager, user, eventId);
        }
      }
      const sourceEvent = await manager.findOne(EventEntity, { where: { id: sourceEventId } });
      const targetEvent = await manager.findOne(EventEntity, { where: { id: targetEventId } });
      if (!sourceEvent || !targetEvent) {
        throw new NotFoundException('Evento de origem ou destino não encontrado');
      }
      const where: Record<string, unknown> = { event: { id: sourceEventId }, isActive: true };
      if (productIds && productIds.length > 0) where.id = In(productIds);
      const sourceProducts = await manager.find(ProductEntity, {
        where, relations: { category: true },
      });
      if (sourceProducts.length === 0) return { importedCount: 0, products: [] };

      const targetCategories = await manager.find(CategoryEntity, {
        where: { event: { id: targetEventId } },
      });
      const categoryMap = new Map<string, CategoryEntity>();
      for (const category of targetCategories) {
        categoryMap.set(category.name.toLowerCase().trim(), category);
      }
      const newProducts: ProductEntity[] = [];
      for (const sourceProduct of sourceProducts) {
        let targetCategory: CategoryEntity | undefined;
        if (sourceProduct.category) {
          const categoryName = sourceProduct.category.name.toLowerCase().trim();
          targetCategory = categoryMap.get(categoryName);
          if (!targetCategory) {
            targetCategory = manager.create(CategoryEntity, {
              event: targetEvent,
              name: sourceProduct.category.name,
              description: sourceProduct.category.description,
              sortOrder: sourceProduct.category.sortOrder,
              isActive: true,
            });
            targetCategory = await manager.save(CategoryEntity, targetCategory);
            categoryMap.set(categoryName, targetCategory);
          }
        }
        newProducts.push(manager.create(ProductEntity, {
          name: sourceProduct.name,
          description: sourceProduct.description,
          imageUrl: sourceProduct.imageUrl,
          price: sourceProduct.price,
          availability: sourceProduct.availability,
          stock: sourceProduct.stock,
          isActive: true,
          category: targetCategory,
          event: targetEvent,
          options: sourceProduct.options ? { ...sourceProduct.options } : undefined,
          modifiers: sourceProduct.modifiers ? { ...sourceProduct.modifiers } : undefined,
          kitchenName: sourceProduct.kitchenName,
        }));
      }
      const savedProducts = await manager.save(ProductEntity, newProducts);
      return { importedCount: savedProducts.length, products: savedProducts };
    });
  }

  async softRemove(
    id: string,
    user: UserEntity,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ deleted: boolean; softDelete: boolean }> {
    return this.productRepository.manager.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, {
        where: { id },
        relations: { event: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');
      if (product.event?.id) {
        await this.assertManagementMembershipInTransaction(manager, user, product.event.id);
      }
      const { event, ...camposProduto } = product;
      arquivar?.({ antes: camposProduto, eventId: event?.id });
      await manager.softDelete(ProductEntity, product.id);
      return { deleted: true, softDelete: true };
    });
  }


}
// ILIKE trata % e _ como wildcards, e \ como escape. Um nome de produto pode
// conter qualquer um dos três, e sem escapar o filtro de cópias contaria
// produtos a mais e saltaria a numeração.
function escaparLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

function escaparRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

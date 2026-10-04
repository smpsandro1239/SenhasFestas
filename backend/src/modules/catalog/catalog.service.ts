import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity, CategoryEntity, UserEntity, EventEntity, OrderEntity, OrderItemEntity } from '../../entities';
import { In, ILike } from 'typeorm';
import { CreateProductDto, UpdateProductDto } from './dto';
import { MembershipService } from '../../common/membership.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    private readonly membershipService: MembershipService,
  ) {}

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

    // 1. Data-driven: co-occurrence from real orders (non-cancelled) of the same event.
    // Products that appear in the same order as the target product, ranked by frequency.
    const whereOrder: Record<string, unknown> = { status: In(['received', 'preparing', 'ready', 'delivered']) };
    if (escopoEvento) {
      whereOrder.event = { id: escopoEvento };
    }
    const orders = await this.orderRepository.find({
      where: whereOrder,
      relations: { items: { product: true } },
    });

    const targetOrderIds = new Set(
      orders.filter((o) => o.items?.some((i) => i.product?.id === productId)).map((o) => o.id),
    );

    const cooccurrence = new Map<string, number>();
    for (const order of orders) {
      if (!targetOrderIds.has(order.id)) continue;
      for (const item of order.items ?? []) {
        const pid = item.product?.id;
        if (!pid || pid === productId || !item.product.isActive) continue;
        cooccurrence.set(pid, (cooccurrence.get(pid) ?? 0) + item.quantity);
      }
    }

    if (cooccurrence.size > 0) {
      const rankedIds = [...cooccurrence.entries()].sort((a, b) => b[1] - a[1]).map(([pid]) => pid).slice(0, limit);
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
    return this.productRepository.find({
      where: { id: In(ids), isActive: true },
      relations: { category: true },
    });
  }

  async findOne(id: string, _user: UserEntity): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(user: UserEntity, dto: CreateProductDto): Promise<ProductEntity> {
    let event: EventEntity | undefined;
    if (dto.eventId) {
      await this.membershipService.assertMember(user, dto.eventId);
      event = await this.eventRepository.findOne({ where: { id: dto.eventId } });
      if (!event) {
        throw new NotFoundException('Evento não encontrado');
      }
    }
    const product = this.productRepository.create({
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
    return this.productRepository.save(product);
  }

  async update(
    id: string,
    user: UserEntity,
    dto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.findOne(id, user);
    if (product.event?.id) {
      await this.membershipService.assertMember(user, product.event.id);
    }
    const { categoryId, ...rest } = dto;
    Object.assign(product, rest);
    if (categoryId !== undefined) {
      product.category = categoryId === null ? null : ({ id: categoryId } as CategoryEntity);
    }
    return this.productRepository.save(product);
  }

  // "Bifana (cópia)" e "Bifana (cópia 2)" reduzem ambos a "Bifana", para que
  // duplicar uma cópia não produza "Bifana (cópia) (cópia)".
  private static readonly SUFIXO_COPIA = /^(.*?)\s*\(cópia(?:\s+\d+)?\)\s*$/;

  async duplicate(id: string, user: UserEntity): Promise<ProductEntity> {
    const source = await this.findOne(id, user);
    if (source.event?.id) {
      await this.membershipService.assertMember(user, source.event.id);
    }

    const base = (CatalogService.SUFIXO_COPIA.exec(source.name)?.[1] ?? source.name).trim()
      || source.name;

    const existentes = await this.productRepository.find({
      where: {
        ...(source.event?.id ? { event: { id: source.event.id } } : {}),
        // Like não escapa nada: um nome com % ou _ no meio passaria a
        // ser wildcard e a contagem de cópias saía errada.
        name: ILike(`${escaparLike(base)} (cópia%`),
      },
    });

    const padrao = new RegExp(`^${escaparRegExp(base)} \\(cópia(?: (\\d+))?\\)$`, 'i');
    let maior = 0;
    for (const p of existentes) {
      const m = padrao.exec(p.name ?? '');
      if (!m) continue;
      const n = m[1] ? Number.parseInt(m[1], 10) : 1;
      if (Number.isFinite(n)) maior = Math.max(maior, n);
    }
    // maximo + 1 e nao o primeiro livre: se o admin apagou a cópia 2, a nova
    // cópia 3 nao reutiliza o número, e o histórico continua legível.
    const sufixo = maior === 0 ? ' (cópia)' : ` (cópia ${maior + 1})`;

    const copy = this.productRepository.create({
      name: `${base}${sufixo}`,
      description: source.description,
      imageUrl: source.imageUrl,
      price: source.price,
      availability: source.availability,
      // stock a 0 e isActive a false: uma cópia nascia comprável e com o
      // stock do original. Escondida, o admin decide quando a activate.
      stock: 0,
      isActive: false,
      category: source.category ? ({ id: source.category.id } as any) : undefined,
      ...(source.event?.id ? { event: { id: source.event.id } as any } : {}),
      // cópias próprias: se o admin editar os options da cópia, a fonte não
      // pode mudar por baixo.
      options: source.options ? { ...source.options } : undefined,
      modifiers: source.modifiers ? { ...source.modifiers } : undefined,
      kitchenName: source.kitchenName,
    });
    return this.productRepository.save(copy);
  }

  async findCategories(): Promise<CategoryEntity[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async softRemove(id: string, user: UserEntity): Promise<{ deleted: boolean; softDelete: boolean }> {
    const product = await this.findOne(id, user);
    if (product.event?.id) {
      await this.membershipService.assertMember(user, product.event.id);
    }
    await this.productRepository.softDelete(product.id);
    return { deleted: true, softDelete: true };
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

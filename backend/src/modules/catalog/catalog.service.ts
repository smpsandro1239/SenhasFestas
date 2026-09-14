import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity, CategoryEntity, UserEntity, EventEntity, OrderEntity, OrderItemEntity } from '../../entities';
import { In } from 'typeorm';
import { CreateProductDto, UpdateProductDto } from './dto';

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
  ) {}

  async findAll(eventId?: string, page = 1, limit = 20): Promise<{ items: ProductEntity[]; total: number; page: number; limit: number }> {
    const where: Record<string, unknown> = { isActive: true };
    if (eventId) {
      where.event = { id: eventId };
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

    // 1. Data-driven: co-occurrence from real orders (non-cancelled) of the same event.
    // Products that appear in the same order as the target product, ranked by frequency.
    const whereOrder: Record<string, unknown> = { status: In(['received', 'preparing', 'ready', 'delivered']) };
    if (eventId) {
      whereOrder.event = { id: eventId };
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
        where: { category: { id: target.category.id }, isActive: true },
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
    if (eventId) {
      wherePopular.event = { id: eventId };
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
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  async softRemove(id: string, user: UserEntity): Promise<{ deleted: boolean; softDelete: boolean }> {
    const product = await this.findOne(id, user);
    await this.productRepository.softDelete(product.id);
    return { deleted: true, softDelete: true };
  }
}
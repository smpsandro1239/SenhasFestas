import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity, CategoryEntity, UserEntity, EventEntity } from '../../entities';
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
  ) {}

  async findAll(eventId?: string, page = 1, limit = 20): Promise<{ items: ProductEntity[]; total: number; page: number; limit: number }> {
    const where: Record<string, unknown> = { isActive: true };
    if (eventId) {
      where.event = { id: eventId };
    }
    const [items, total] = await this.productRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, limit };
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
}
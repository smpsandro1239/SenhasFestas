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
  ) {}

  async findAll(): Promise<ProductEntity[]> {
    return this.productRepository.find({
      where: { isActive: true },
      relations: ['category'],
    });
  }

  async findOne(id: string, user: UserEntity): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'event'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(user: UserEntity, dto: CreateProductDto): Promise<ProductEntity> {
    const product = this.productRepository.create({
      ...dto,
      price: dto.price,
      isActive: true,
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
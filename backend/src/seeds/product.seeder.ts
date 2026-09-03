import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity, ProductEntity } from '../entities';

@Injectable()
export class ProductSeederService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async seed(): Promise<void> {
    await this.seedCategories();
    await this.seedProducts();
  }

  async seedCategories(): Promise<void> {
    const categoriesExist = await this.categoryRepository.findOne({});
    if (categoriesExist) {
      console.log('[ProductSeeder] Categorias ja existem, a saltar...');
      return;
    }

    const categories = [
      { name: 'Bebidas', description: 'Bebidas alcoólicas e não alcoólicas', sortOrder: 1 },
      { name: 'Comidas', description: 'Pratos e petiscos', sortOrder: 2 },
      { name: 'Sobremesas', description: 'Doces e sobremesas', sortOrder: 3 },
      { name: 'Extras', description: 'Extras e acompanhamentos', sortOrder: 4 },
    ];

    for (const cat of categories) {
      const category = this.categoryRepository.create(cat);
      await this.categoryRepository.save(category);
    }

    console.log(`[ProductSeeder] ${categories.length} categorias criadas`);
  }

  async seedProducts(): Promise<void> {
    const productsExist = await this.productRepository.findOne({});
    if (productsExist) {
      console.log('[ProductSeeder] Produtos ja existem, a saltar...');
      return;
    }

    const categories = await this.categoryRepository.find({});

    const products = [
      // Bebidas
      { name: 'Cerveja Artesanal', description: 'Cerveja local de 50cl', price: 3.50, category: categories[0], availability: 'available', stock: 100 },
      { name: 'Sangria', description: 'Sangria tradicional 25cl', price: 4.00, category: categories[0], availability: 'available', stock: 50 },
      { name: 'Vinho Verde', description: 'Copo de vinho verde 15cl', price: 2.50, category: categories[0], availability: 'available', stock: 80 },
      { name: 'Água', description: 'Água mineral 50cl', price: 1.00, category: categories[0], availability: 'available', stock: 200 },
      { name: 'Refrigerante', description: 'Latas de refrigerante 33cl', price: 1.50, category: categories[0], availability: 'available', stock: 150 },
      { name: 'Sumo Natural', description: 'Sumo de laranja natural 25cl', price: 2.00, category: categories[0], availability: 'available', stock: 60 },
      { name: 'Café', description: 'Café espresso', price: 1.00, category: categories[0], availability: 'available', stock: 100 },
      { name: 'Ginjinha', description: 'Ginjinha tradicional 5cl', price: 1.50, category: categories[0], availability: 'available', stock: 80 },

      // Comidas
      { name: 'Bifana', description: 'Bifana tradicional com molho', price: 5.00, category: categories[1], availability: 'available', stock: 50 },
      { name: 'Caldo Verde', description: 'Caldo verde com broa', price: 4.00, category: categories[1], availability: 'available', stock: 40 },
      { name: 'Francesinha', description: 'Francesinha com salsa', price: 7.50, category: categories[1], availability: 'available', stock: 30 },
      { name: 'Tosta Mista', description: 'Tosta mista com salada', price: 4.50, category: categories[1], availability: 'available', stock: 40 },
      { name: 'Petiscos', description: 'Prato de petiscos variados', price: 8.00, category: categories[1], availability: 'available', stock: 25 },
      { name: 'Pataniscas de Bacalhau', description: 'Pataniscas fritas com arroz', price: 6.50, category: categories[1], availability: 'available', stock: 20 },

      // Sobremesas
      { name: 'Baba de Camelo', description: 'Baba de camelo tradicional', price: 3.00, category: categories[2], availability: 'available', stock: 30 },
      { name: 'Pudim Abade de Priscos', description: 'Pudim tradicional minhoto', price: 3.50, category: categories[2], availability: 'available', stock: 25 },
      { name: 'Bolo de Mel', description: 'Bolo de mel caseiro', price: 2.50, category: categories[2], availability: 'available', stock: 35 },

      // Extras
      { name: 'Batatas Fritas', description: 'Porção de batatas fritas', price: 2.00, category: categories[3], availability: 'available', stock: 60 },
      { name: 'Azeitonas', description: 'Prato de azeitonas', price: 1.50, category: categories[3], availability: 'available', stock: 50 },
      { name: 'Pão com Alho', description: 'Pão torrado com alho', price: 1.50, category: categories[3], availability: 'available', stock: 40 },
      { name: 'Queijo da Serra', description: 'Porção de queijo da Serra', price: 4.00, category: categories[3], availability: 'available', stock: 20 },
    ];

    for (const prod of products) {
      const product = this.productRepository.create(prod);
      await this.productRepository.save(product);
    }

    console.log(`[ProductSeeder] ${products.length} produtos criados`);
  }
}

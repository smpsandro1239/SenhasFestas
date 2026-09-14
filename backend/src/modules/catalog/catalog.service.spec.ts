import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { CatalogService } from './catalog.service';

const mockProductRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockCategoryRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockEventRepository = {
  findOne: vi.fn(),
  find: vi.fn(),
};

const mockOrderRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
};

const mockOrderItemRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
};

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService(
      mockProductRepository as any,
      mockCategoryRepository as any,
      mockEventRepository as any,
      mockOrderRepository as any,
      mockOrderItemRepository as any,
    );
  });

  describe('findAll', () => {
    it('returns only active products', async () => {
      const products = [{ id: 'p1', name: 'Bifana', isActive: true }];
      mockProductRepository.findAndCount.mockResolvedValue([products, 1]);

      await expect(service.findAll()).resolves.toEqual({
        items: products,
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(mockProductRepository.findAndCount).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: { category: true, event: true },
        skip: 0,
        take: 20,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the product when found', async () => {
      const product = { id: 'p1', name: 'Bifana' };
      mockProductRepository.findOne.mockResolvedValue(product);

      await expect(service.findOne('p1', {} as any)).resolves.toEqual(product);
    });

    it('throws NotFoundException when missing', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('p1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('saves a new active product', async () => {
      const dto = { name: 'Cachorro', price: 5.5, categoryId: 'c1' };
      mockProductRepository.create.mockImplementation((data: any) => data);
      mockProductRepository.save.mockImplementation(async (data: any) => ({
        id: 'p2',
        ...data,
      }));

      await expect(service.create({} as any, dto as any)).resolves.toMatchObject({
        id: 'p2',
        isActive: true,
      });
    });
  });

  describe('update', () => {
    it('merges dto into the found product and saves', async () => {
      const existing = { id: 'p1', name: 'Bifana', price: 3.5 };
      mockProductRepository.findOne.mockResolvedValue(existing);
      mockProductRepository.save.mockImplementation(async (data: any) => data);

      const result = await service.update('p1', {} as any, { price: 4 } as any);

      expect(result).toMatchObject({ id: 'p1', name: 'Bifana', price: 4 });
    });

    it('throws NotFoundException when product to update is missing', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('p1', {} as any, { price: 4 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSuggestions', () => {
    it('returns co-occurring products ranked by frequency', async () => {
      const target = { id: 'p1', category: { id: 'c1' }, event: { id: 'e1' } };
      mockProductRepository.findOne.mockResolvedValue(target);
      const orders = [
        {
          id: 'o1',
          items: [
            { product: { id: 'p1', isActive: true }, quantity: 4 },
            { product: { id: 'p2', isActive: true }, quantity: 5 },
            { product: { id: 'p3', isActive: true }, quantity: 2 },
          ],
        },
      ];
      mockOrderRepository.find.mockResolvedValue(orders);
      mockProductRepository.find.mockResolvedValue([
        { id: 'p2' },
        { id: 'p3' },
      ]);

      const result: any = await service.findSuggestions('e1', 'p1', 4);

      expect(result.source).toBe('cooccurrence');
      expect(result.items).toEqual([{ id: 'p2' }, { id: 'p3' }]);
      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        where: {
          status: In(['received', 'preparing', 'ready', 'delivered']),
          event: { id: 'e1' },
        },
        relations: { items: { product: true } },
      });
    });

    it('falls back to same-category products when no co-occurrence', async () => {
      const target = { id: 'p1', category: { id: 'c1' }, event: null };
      mockProductRepository.findOne.mockResolvedValue(target);
      mockOrderRepository.find.mockResolvedValue([]);
      mockProductRepository.find.mockResolvedValue([
        { id: 'p2', name: 'Bifana XL' },
        { id: 'p1' },
      ]);

      const result: any = await service.findSuggestions('e1', 'p1', 4);

      expect(result.source).toBe('category');
      expect(result.items).toEqual([{ id: 'p2', name: 'Bifana XL' }]);
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        where: { category: { id: 'c1' }, isActive: true },
        relations: { category: true },
        take: 5,
        order: { createdAt: 'DESC' },
      });
    });

    it('falls back to popular products when no category', async () => {
      const target = { id: 'p1', category: null, event: null };
      mockProductRepository.findOne.mockResolvedValue(target);
      mockOrderRepository.find.mockResolvedValue([]);
      mockProductRepository.find.mockResolvedValue([
        { id: 'p2', stock: 50 },
        { id: 'p1' },
      ]);

      const result: any = await service.findSuggestions(undefined, 'p1', 4);

      expect(result.source).toBe('popular');
      expect(result.items).toEqual([{ id: 'p2', stock: 50 }]);
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: { category: true },
        take: 5,
        order: { stock: 'DESC' },
      });
    });

    it('throws NotFoundException when target product is missing', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.findSuggestions('e1', 'p1', 4)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
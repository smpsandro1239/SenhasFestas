import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

const mockProductRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockCategoryRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService(
      mockProductRepository as any,
      mockCategoryRepository as any,
    );
  });

  describe('findAll', () => {
    it('returns only active products', async () => {
      const products = [{ id: 'p1', name: 'Bifana', isActive: true }];
      mockProductRepository.find.mockResolvedValue(products);

      await expect(service.findAll()).resolves.toEqual(products);
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
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
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';
import { CatalogService } from './catalog.service';
import { UpdateProductDto } from './dto';

const mockProductRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
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

const mockMembershipService = {
  assertMember: vi.fn(),
};

describe('CatalogService', () => {
  let service: CatalogService;

  const MEMBRO = { id: 'membro', role: 'organizer' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMembershipService.assertMember.mockResolvedValue(undefined);
    service = new CatalogService(
      mockProductRepository as any,
      mockCategoryRepository as any,
      mockEventRepository as any,
      mockOrderRepository as any,
      mockOrderItemRepository as any,
      mockMembershipService as any,
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

    it('sets the category relation when categoryId is provided', async () => {
      const existing = { id: 'p1', name: 'Bifana', category: null };
      mockProductRepository.findOne.mockResolvedValue(existing);
      mockProductRepository.save.mockImplementation(async (data: any) => data);

      const result = await service.update('p1', {} as any, { categoryId: 'c1' } as any);

      expect(result.category).toEqual({ id: 'c1' });
      expect(result).not.toHaveProperty('categoryId');
      expect(mockProductRepository.save).toHaveBeenCalled();
    });

    it('clears the category when categoryId is null', async () => {
      const existing = { id: 'p1', name: 'Bifana', category: { id: 'c1' } };
      mockProductRepository.findOne.mockResolvedValue(existing);
      mockProductRepository.save.mockImplementation(async (data: any) => data);

      const result = await service.update('p1', {} as any, { categoryId: null } as any);

      expect(result.category).toBeNull();
    });

    it('clears a scalar field when the dto sends null', async () => {
      // E o que o formulario de editar depende: para o utilizador limpar a
      // descricao ou o stock, o cliente tem de mandar null. O Object.assign
      // copia o null tal e qual, e o JSON.stringify do cliente omite chaves
      // com undefined — ou seja, omitir a chave e o que significa "nao mexer".
      const existing = { id: 'p1', name: 'Bifana', description: 'Pao e carne', stock: 10 };
      mockProductRepository.findOne.mockResolvedValue(existing);
      mockProductRepository.save.mockImplementation(async (data: any) => data);

      const result = await service.update(
        'p1',
        {} as any,
        { description: null, stock: null } as any,
      );

      expect(result.description).toBeNull();
      expect(result.stock).toBeNull();
      expect(result.name).toBe('Bifana');
    });

    it('throws NotFoundException when product to update is missing', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('p1', {} as any, { price: 4 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCategories', () => {
    it('returns active categories ordered by sortOrder then name', async () => {
      const categories = [
        { id: 'c1', name: 'Bebidas', sortOrder: 1, isActive: true },
        { id: 'c2', name: 'Extras', sortOrder: 4, isActive: true },
      ];
      mockCategoryRepository.find.mockResolvedValue(categories);

      await expect(service.findCategories()).resolves.toEqual(categories);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
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

      const result: any = await service.findSuggestions(MEMBRO, 'e1', 'p1', 4);

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

      const result: any = await service.findSuggestions(MEMBRO, 'e1', 'p1', 4);

      expect(result.source).toBe('category');
      expect(result.items).toEqual([{ id: 'p2', name: 'Bifana XL' }]);
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        where: { category: { id: 'c1' }, isActive: true, event: { id: 'e1' } },
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

      const result: any = await service.findSuggestions(MEMBRO, undefined, 'p1', 4);

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

      await expect(service.findSuggestions(MEMBRO, 'e1', 'p1', 4)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isolamento entre eventos', () => {
    const ORGANIZADOR_X = { id: 'organizadorX', role: 'organizer' } as any;

    it('rejeita criar produto num evento fora do scope do ator', async () => {
      mockMembershipService.assertMember.mockRejectedValue(
        new ForbiddenException('Não pertence a este evento'),
      );
      await expect(
        service.create(ORGANIZADOR_X, { eventId: 'eventoY' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockMembershipService.assertMember).toHaveBeenCalledWith(ORGANIZADOR_X, 'eventoY');
    });

    it('rejeita atualizar produto de um evento fora do scope do ator', async () => {
      mockProductRepository.findOne.mockResolvedValue({ id: 'produtoY', event: { id: 'eventoY' } });
      mockMembershipService.assertMember.mockRejectedValue(
        new ForbiddenException('Não pertence a este evento'),
      );
      await expect(
        service.update('produtoY', ORGANIZADOR_X, { price: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockMembershipService.assertMember).toHaveBeenCalledWith(ORGANIZADOR_X, 'eventoY');
    });

    it('rejeita eliminar produto de um evento fora do scope do ator', async () => {
      mockProductRepository.findOne.mockResolvedValue({ id: 'produtoY', event: { id: 'eventoY' } });
      mockMembershipService.assertMember.mockRejectedValue(
        new ForbiddenException('Não pertence a este evento'),
      );
      await expect(service.softRemove('produtoY', ORGANIZADOR_X)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockMembershipService.assertMember).toHaveBeenCalledWith(ORGANIZADOR_X, 'eventoY');
    });

    it('sugestões sem eventId ficam limitadas ao evento do produto alvo (fallback de categoria)', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'produtoX',
        category: { id: 'catA' },
        event: { id: 'eventoX' },
      });
      mockOrderRepository.find.mockResolvedValue([]);
      mockProductRepository.find.mockResolvedValueOnce([
        { id: 'mesmaCategoria', category: { id: 'catA' }, event: { id: 'eventoY' } },
      ]);

      await service.findSuggestions(MEMBRO, undefined, 'produtoX', 4);

      expect(mockProductRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { id: 'catA' },
            event: { id: 'eventoX' },
          }),
        }),
      );
    });

    it('sugestões sem eventId ficam limitadas ao evento do produto alvo (fallback popular)', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'produtoX',
        category: { id: 'catA' },
        event: { id: 'eventoX' },
      });
      mockOrderRepository.find.mockResolvedValue([]);
      mockProductRepository.find.mockResolvedValueOnce([]);
      mockProductRepository.find.mockResolvedValueOnce([
        { id: 'outroProduto', name: 'P', price: '1', stock: 1 },
      ]);

      const resultado = await service.findSuggestions(MEMBRO, undefined, 'produtoX', 4);

      expect(resultado.source).toBe('popular');
      expect(mockProductRepository.find).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ event: { id: 'eventoX' } }),
        }),
      );
    });

    it('rejeita sugestões quando o ator não pertence ao evento indicado no query', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'produtoY',
        category: null,
        event: { id: 'eventoY' },
      });
      mockMembershipService.assertMember.mockRejectedValue(
        new ForbiddenException('Não pertence a este evento'),
      );

      await expect(
        service.findSuggestions(MEMBRO, 'eventoY', 'produtoY', 4),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockMembershipService.assertMember).toHaveBeenCalledWith(MEMBRO, 'eventoY');
    });

    it('rejeita sugestões quando o ator não pertence ao evento do produto alvo', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'produtoY',
        category: null,
        event: { id: 'eventoY' },
      });
      mockMembershipService.assertMember.mockRejectedValue(
        new ForbiddenException('Não pertence a este evento'),
      );

      await expect(
        service.findSuggestions(MEMBRO, undefined, 'produtoY', 4),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockMembershipService.assertMember).toHaveBeenCalledWith(MEMBRO, 'eventoY');
    });
  });

  // O formulario de editar limpa campos mandando null. Se o ValidationPipe
  // (whitelist + forbidNonWhitelisted) rejeitasse null, limpar a descricao
  // daria 400 em vez de limpar. Estes testes fixam essa garantia sem base de
  // dados: validam o DTO directamente.
  describe('UpdateProductDto — null limpa, nao invalida', () => {
    const validar = async (payload: Record<string, unknown>) => {
      const dto = plainToInstance(UpdateProductDto, payload);
      return validate(dto as object);
    };

    it('aceita null em description, stock e categoryId', async () => {
      const errors = await validar({ name: 'Bifana', description: null, stock: null, categoryId: null });
      expect(errors).toHaveLength(0);
    });

    it('aceita null sozinho, sem os outros campos', async () => {
      expect(await validar({ description: null })).toHaveLength(0);
      expect(await validar({ stock: null })).toHaveLength(0);
    });

    it('continua a rejeitar tipos invalidos', async () => {
      // Se IsOptional passasse a aceitar tudo, estes limites desapareceriam
      // tambem. E o que garante que null nao enfraqueceu o DTO.
      expect(await validar({ name: 123 })).not.toHaveLength(0);
      expect(await validar({ price: 'abc' })).not.toHaveLength(0);
      expect(await validar({ categoryId: 'nao-e-uuid' })).not.toHaveLength(0);
    });

    it('nao aceita chaves fora do DTO', async () => {
      // forbidNonWhitelisted rejeita estas; o DTO nao as declara, logo
      // validate() nao as ve. Este teste documenta a lista fechada.
      const chaves = Object.keys(new UpdateProductDto());
      expect(chaves).not.toContain('isActive');
    });
  });
});
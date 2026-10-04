import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { validate, getMetadataStorage } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { In, ILike } from 'typeorm';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CreateProductDto, UpdateProductDto } from './dto';
import { MANAGEMENT_ROLES } from '../../common/roles';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

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

  // O formulario de editar limpa campos mandando null. Se o ValidationPipe
  // (whitelist + forbidNonWhitelisted) rejeitasse null, limpar a descricao
  // daria 400 em vez de limpar. Estes testes fixam essa garantia sem base de
  // dados: validam o DTO directamente.
  const validar = async (payload: Record<string, unknown>) =>
    validate(plainToInstance(UpdateProductDto, payload) as object);

  const validarCreate = async (payload: Record<string, unknown>) =>
    validate(plainToInstance(CreateProductDto, payload) as object);

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

    it('includeInactive traz os inativos junto com os ativos', async () => {
      // Nao e "so os inativos": includeInactive significa incluir, nao filtrar.
      // Onde nao ha isActive no where, o TypeORM devolve ambos.
      mockProductRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(undefined, 1, 20, { includeInactive: true });

      expect(mockProductRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('includeInactive=false continua a filtrar os inativos', async () => {
      mockProductRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(undefined, 1, 20, { includeInactive: false });

      expect(mockProductRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('includeInactive preserva os outros filtros', async () => {
      mockProductRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll('e1', 1, 20, {
        includeInactive: true,
        q: 'bifana',
        availability: 'unavailable',
      });

      expect(mockProductRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            event: { id: 'e1' },
            name: ILike('%bifana%'),
            availability: 'unavailable',
          },
        }),
      );
    });
  });

  // O includeInactive e pedido por query string, e o endpoint e partilhado
  // por admin, POS e QR. Quem pode desativar um produto (MANAGEMENT_ROLES) e
  // quem pode ver os inativos; um cashier que mande includeInactive=true nao
  // pode ficar a ver produtos que nao consegue gerir.
  describe('includeInactive só é honrado para quem gere o catálogo', () => {
    const controller = new CatalogController(
      { findAll: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }) } as any,
      { assertMember: vi.fn() } as any,
    );

    const listaChamada = (role: string, includeInactive?: string) => {
      controller['catalogService'].findAll = vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      return controller
        .findAll(
          { page: 1, limit: 20, includeInactive } as any,
          { user: { id: 'u1', role } } as any,
        )
        .then(() => controller['catalogService'].findAll);
    };

    it.each(MANAGEMENT_ROLES)('%s recebe os inativos quando pede', async (role) => {
      const spy = await listaChamada(role, 'true');
      expect(spy).toHaveBeenCalledWith(undefined, 1, 20, expect.objectContaining({ includeInactive: true }));
    });

    it.each(['cashier', 'treasurer', 'bar', 'kitchen'])(
      '%s nao recebe os inactivos mesmo que peça',
      async (role) => {
        const spy = await listaChamada(role, 'true');
        expect(spy).toHaveBeenCalledWith(
          undefined,
          1,
          20,
          expect.objectContaining({ includeInactive: false }),
        );
      },
    );

    it('client nem chega a ver a lista: sai antes, sem eventId', async () => {
      // o early return de role=client sem eventId. Nao ha lista para filtrar,
      // logo includeInactive nem chega a ser avaliado.
      const spy = await listaChamada('client', 'true');
      expect(spy).not.toHaveBeenCalled();
    });

    it("includeInactive='false' conta como nao pedir", async () => {
      // query strings sao sempre string. Se a controller testasse a
      // truthiness, 'false' seria truthy e mostraria os inativos.
      const spy = await listaChamada('superadmin', 'false');
      expect(spy).toHaveBeenCalledWith(
        undefined,
        1,
        20,
        expect.objectContaining({ includeInactive: false }),
      );
    });

    it('sem o parametro, o default mantem so os ativos', async () => {
      const spy = await listaChamada('superadmin');
      expect(spy).toHaveBeenCalledWith(
        undefined,
        1,
        20,
        expect.objectContaining({ includeInactive: false }),
      );
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

  describe('duplicate — rota só para quem gere o catálogo', () => {
    const controller = new CatalogController(
      { duplicate: vi.fn(), softRemove: vi.fn() } as any,
      { assertMember: vi.fn() } as any,
    );
    const CHAMADO = { id: 'p1' };

    beforeEach(() => {
      controller['catalogService'].duplicate.mockResolvedValue(CHAMADO);
    });

    it.each(MANAGEMENT_ROLES)('%s chega ao serviço', async (role) => {
      await expect(
        controller.duplicate('p1', { user: { id: 'u1', role } } as any),
      ).resolves.toBe(CHAMADO);
      expect(controller['catalogService'].duplicate).toHaveBeenCalledWith('p1', {
        id: 'u1',
        role,
      });
    });

    it('o @Roles da rota e MANAGEMENT_ROLES', () => {
      // Os testes acima exercitam o metodo. O que impede mesmo um cashier de
      // duplicar e o decorator, que o RolesGuard le — testar so o metodo
      // deixaria a protecao por testar.
      const handler = controller.duplicate;
      expect(Reflect.getMetadata(ROLES_KEY, handler) ?? []).toEqual(MANAGEMENT_ROLES);
    });
  });

  describe('duplicate', () => {
    const FONTE = {
      id: 'p1',
      name: 'Bifana',
      description: 'queijo e fiambre',
      imageUrl: 'https://cdn/bifana.jpg',
      price: 3.5,
      availability: 'unavailable',
      stock: 17,
      isActive: true,
      category: { id: 'c1', name: 'Sandes' },
      options: { tamanho: ['P', 'G'] },
      modifiers: { extras: ['bacon'] },
      kitchenName: 'Bifana PF',
      event: { id: 'e1' },
    };

    beforeEach(() => {
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE });
      // find() responde tanto aos nomes ja existentes (para o sufixo) como a
      // qualquer outra consulta do service.
      mockProductRepository.find.mockResolvedValue([]);
      mockProductRepository.create.mockImplementation((dto: any) => ({ id: 'novo', ...dto }));
      mockProductRepository.save.mockImplementation(async (p: any) => p);
    });

    it('copia os campos escalares e zera o stock', async () => {
      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bifana (cópia)',
          description: 'queijo e fiambre',
          imageUrl: 'https://cdn/bifana.jpg',
          price: 3.5,
          // availability copia-se: um duplicado de um produto indisponível é
          // um duplicado indisponível, e o admin ajusta depois.
          availability: 'unavailable',
          stock: 0,
          // esconder de imediato evita vender um duplicado com stock 0 antes
          // de o admin o rever.
          isActive: false,
        }),
      );
    });

    it('copia categoria, evento, options, modifiers e kitchenName', async () => {
      // A decisão inicial listava 5 campos. Deixar options/modifiers de fora
      // perderia dados em silencio: a cópia de uma sandes com extras deixaria
      // de ter extras, e ninguém notava até um pedido sair errado.
      await service.duplicate('p1', MEMBRO);

      const criado = mockProductRepository.create.mock.calls[0][0];
      expect(criado.category).toEqual({ id: 'c1' });
      expect(criado.event).toEqual({ id: 'e1' });
      expect(criado.options).toEqual({ tamanho: ['P', 'G'] });
      expect(criado.modifiers).toEqual({ extras: ['bacon'] });
      expect(criado.kitchenName).toBe('Bifana PF');
    });

    it('não partilha a referência dos objetos jsonb com a fonte', async () => {
      await service.duplicate('p1', MEMBRO);

      const criado = mockProductRepository.create.mock.calls[0][0];
      expect(criado.options).not.toBe(FONTE.options);
      expect(criado.modifiers).not.toBe(FONTE.modifiers);
    });

    it('incrementa o sufixo a partir do que já existe', async () => {
      mockProductRepository.find.mockResolvedValue([
        { name: 'Bifana (cópia)' },
        { name: 'Bifana (cópia 2)' },
      ]);

      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bifana (cópia 3)' }),
      );
    });

    it('numera a partir de 1 quando ainda não há cópias', async () => {
      mockProductRepository.find.mockResolvedValue([{ name: 'Bifana (outra)' }]);

      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bifana (cópia)' }),
      );
    });

    it('duplicar uma cópia não empilha o sufixo', async () => {
      // "Bifana (cópia)" duplicada tem de dar "Bifana (cópia 2)", não
      // "Bifana (cópia) (cópia)".
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE, name: 'Bifana (cópia)' });
      mockProductRepository.find.mockResolvedValue([{ name: 'Bifana (cópia)' }]);

      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bifana (cópia 2)' }),
      );
    });

    it('duplicar a cópia 2 não volta ao 2', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE, name: 'Bifana (cópia 2)' });
      mockProductRepository.find.mockResolvedValue([
        { name: 'Bifana (cópia)' },
        { name: 'Bifana (cópia 2)' },
      ]);

      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bifana (cópia 3)' }),
      );
    });

    it('procura as cópias dentro do mesmo evento', async () => {
      await service.duplicate('p1', MEMBRO);

      const [where] = mockProductRepository.find.mock.calls[0];
      expect(where).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ event: { id: 'e1' } }),
        }),
      );
    });

    it('escapa % e _ do nome no padrão de busca', async () => {
      // Sem escape, um produto chamado "Bife 50%_off" geraria o padrão
      // "Bife 50%_off (cópia%", em que o % é wildcard: o ILIKE devolveria
      // também as cópias de outros produtos e a numeração saltava.
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE, name: 'Bife 50%_off' });

      await service.duplicate('p1', MEMBRO);

      const op = mockProductRepository.find.mock.calls[0][0].where.name;
      expect(op._value).toBe('Bife 50\\%\\_off (cópia%');
    });

    it('o nome da cópia com % escapado sai limpo', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE, name: 'Bife 50%_off' });
      mockProductRepository.find.mockResolvedValue([{ name: 'Bife 50%_off (cópia)' }]);

      await service.duplicate('p1', MEMBRO);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bife 50%_off (cópia 2)' }),
      );
    });

    it('não duplica um produto de outro evento', async () => {
      mockMembershipService.assertMember.mockRejectedValue(new ForbiddenException());

      await expect(service.duplicate('p1', MEMBRO)).rejects.toThrow(ForbiddenException);
      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('não duplica um produto inexistente ou apagado', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.duplicate('p1', MEMBRO)).rejects.toThrow(NotFoundException);
      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('duplica um produto inativo — inativo não é apagado', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...FONTE, isActive: false });

      await expect(service.duplicate('p1', MEMBRO)).resolves.toBeDefined();
      expect(mockProductRepository.save).toHaveBeenCalled();
    });

    it('devolve o produto gravado', async () => {
      await expect(service.duplicate('p1', MEMBRO)).resolves.toEqual(
        expect.objectContaining({ id: 'novo', name: 'Bifana (cópia)' }),
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

    it('passa kitchenName para o produto criado', async () => {
      // kitchenName é o nome que a cozinha vê, e pode ser diferente do nome de
      // menu. Sem o pass-through, o campo nunca chegava à base de dados.
      mockProductRepository.create.mockImplementation((data: any) => data);

      await service.create({} as any, { name: 'Cachorro', price: 5, kitchenName: 'Cachorro PF' } as any);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ kitchenName: 'Cachorro PF' }),
      );
    });
  });

  describe('kitchenName — o nome que a cozinha lê', () => {
    it('aceita string em create e em update', async () => {
      expect(await validarCreate({ name: 'Bifana', price: 3.5, kitchenName: 'Bifana PF' })).toHaveLength(0);
      expect(await validar({ kitchenName: 'Bifana PF' })).toHaveLength(0);
    });

    it('null passa em create e em update, porque IsOptional salta null', async () => {
      // Facto do class-validator, não escolha: @IsOptional() pula a validação
      // quando o valor é null OU undefined. Por isso o update consegue
      // limpar mandando null, e não apesar do tipo — o `string | null` no DTO
      // documenta a intenção em tempo de compilação, e o que deixa o null
      // passar em runtime é o IsOptional. Criar com null também passa, e é
      // inofensivo: a coluna é nullable.
      expect(await validar({ kitchenName: null })).toHaveLength(0);
      expect(await validarCreate({ name: 'Bifana', price: 3.5, kitchenName: null })).toHaveLength(0);
    });

    it('rejeita tipos que não são string', async () => {
      expect(await validar({ kitchenName: 123 })).not.toHaveLength(0);
      expect(await validar({ kitchenName: {} })).not.toHaveLength(0);
    });

    it('update aplica o valor novo e limpa com null', async () => {
      const existente = { id: 'p1', name: 'Bifana', kitchenName: 'Bifana PF' };
      mockProductRepository.findOne.mockResolvedValue({ ...existente });
      mockProductRepository.save.mockImplementation(async (d: any) => d);

      await service.update('p1', {} as any, { kitchenName: 'Bifana Especial' } as any);
      expect(mockProductRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ kitchenName: 'Bifana Especial' }),
      );

      mockProductRepository.findOne.mockResolvedValue({ ...existente });
      await service.update('p1', {} as any, { kitchenName: null } as any);
      expect(mockProductRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ kitchenName: null }),
      );
    });

    it('update sem kitchenName não mexe no que lá estava', async () => {
      // O DTO tem de continuar a ser parcial: mexer no preço não pode
      // apagar o nome da cozinha.
      const existente = { id: 'p1', name: 'Bifana', kitchenName: 'Bifana PF' };
      mockProductRepository.findOne.mockResolvedValue({ ...existente });
      mockProductRepository.save.mockImplementation(async (d: any) => d);

      await service.update('p1', {} as any, { price: 4 } as any);

      expect(mockProductRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ kitchenName: 'Bifana PF' }),
      );
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

  // O formulario de editar limpa campos mandando null. Ver os helpers
  // validar/validarCreate no topo deste describe.
  describe('UpdateProductDto — null limpa, nao invalida', () => {

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

    it('aceita isActive booleano, nos dois sentidos', async () => {
      expect(await validar({ isActive: false })).toHaveLength(0);
      expect(await validar({ isActive: true })).toHaveLength(0);
    });

    it('rejeita isActive que nao seja booleano', async () => {
      // 'false' como string e o perigo classico: truthy em JS. O DTO tem de
      // recusar, senao um cliente que mande string desativa o produto.
      expect(await validar({ isActive: 'false' })).not.toHaveLength(0);
      expect(await validar({ isActive: 'true' })).not.toHaveLength(0);
      expect(await validar({ isActive: 1 })).not.toHaveLength(0);
      expect(await validar({ isActive: 0 })).not.toHaveLength(0);
    });

    it('a whitelist do DTO tem isActive e kitchenName, e mantem o resto', () => {
      // A whitelist nao se lê de Object.keys(new UpdateProductDto()) — campos
      // so com decoradores nao sao propriedades proprias em runtime, e isso
      // devolve []. Qualquer teste por essa via passa vacuamente. A fonte
      // verdadeira e a metadata de validacao, que e o que o
      // forbidNonWhitelisted consulta.
      const metas = getMetadataStorage().getTargetValidationMetadatas(
        UpdateProductDto,
        undefined,
        true,
        false,
      );
      const props = [...new Set(metas.map((m) => m.propertyName))].sort();

      expect(props).toEqual([
        'availability',
        'categoryId',
        'description',
        'imageUrl',
        'isActive',
        'kitchenName',
        'name',
        'price',
        'stock',
      ]);
    });
  });
});
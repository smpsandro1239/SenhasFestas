import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FloorPlanService } from './floor-plan.service';

const mockFloorPlanRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  count: vi.fn(),
};

const mockEventService = {
  findOne: vi.fn(),
};

const ORGANIZADOR = { id: 'organizador', role: 'organizer' } as any;

function novaLinha(extra: any = {}) {
  return {
    id: 'p1',
    nome: 'Principal',
    documento: { mesas: [], zonas: [] },
    version: 0,
    ...extra,
  };
}

describe('FloorPlanService — listagem e criação', () => {
  let service: FloorPlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FloorPlanService(
      mockFloorPlanRepository as any,
      mockEventService as any,
    );
    mockEventService.findOne.mockResolvedValue({ id: 'evt1' });
  });

  it('listar devolve id, nome e version de cada planta', async () => {
    mockFloorPlanRepository.find.mockResolvedValue([
      novaLinha({ id: 'p1', nome: 'Principal', version: 3 }),
      novaLinha({ id: 'p2', nome: 'Esplanada', version: 0 }),
    ]);

    await expect(service.listar('evt1', ORGANIZADOR)).resolves.toEqual([
      { id: 'p1', nome: 'Principal', version: 3 },
      { id: 'p2', nome: 'Esplanada', version: 0 },
    ]);
    expect(mockFloorPlanRepository.find).toHaveBeenCalledWith({
      where: { event: { id: 'evt1' } },
      order: { createdAt: 'ASC' },
    });
  });

  it('listar → 404 se o evento não existir', async () => {
    mockEventService.findOne.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(service.listar('naoexiste', ORGANIZADOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mockFloorPlanRepository.find).not.toHaveBeenCalled();
  });

  it('criar normaliza o nome e devolve a planta com version 0', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);
    const linha = novaLinha({ id: 'p2', nome: 'Esplanada' });
    mockFloorPlanRepository.create.mockReturnValue(linha);
    mockFloorPlanRepository.save.mockResolvedValue(linha);
    const arquivar = vi.fn();

    await expect(
      service.criar('evt1', ORGANIZADOR, { nome: '  Esplanada  ' } as any, arquivar),
    ).resolves.toEqual({ id: 'p2', nome: 'Esplanada', version: 0 });
    expect(mockFloorPlanRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Esplanada', version: 0 }),
    );
    expect(arquivar).toHaveBeenCalledWith({
      entidadeId: 'p2',
      eventId: 'evt1',
      extras: { nome: 'Esplanada' },
    });
  });

  it('criar → 409 se já existir planta com o mesmo nome', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha({ nome: 'Esplanada' }));

    await expect(
      service.criar('evt1', ORGANIZADOR, { nome: 'Esplanada' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });

  it('criar → 409 na corrida de unicidade (23505)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);
    mockFloorPlanRepository.create.mockReturnValue(novaLinha());
    mockFloorPlanRepository.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(
      service.criar('evt1', ORGANIZADOR, { nome: 'Esplanada' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('criar → 400 para nome vazio', async () => {
    await expect(
      service.criar('evt1', ORGANIZADOR, { nome: '   ' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });

  it('criar → 404 se o evento não existir', async () => {
    mockEventService.findOne.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(
      service.criar('naoexiste', ORGANIZADOR, { nome: 'Esplanada' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });
});

describe('FloorPlanService — obter/guardar (optimistic locking)', () => {
  let service: FloorPlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FloorPlanService(
      mockFloorPlanRepository as any,
      mockEventService as any,
    );
    mockEventService.findOne.mockResolvedValue({ id: 'evt1' });
    mockFloorPlanRepository.save.mockImplementation(async (e: any) => e);
  });

  it('obter devolve mesas, zonas e version guardadas', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: {
          mesas: [{ id: 'mesa-1' }],
          zonas: [{ id: 'z1', nome: 'Zona', cor: '#fff', x: 10, y: 10, w: 20, h: 20 }],
        },
        version: 3,
      }),
    );

    await expect(service.obter('evt1', 'p1', ORGANIZADOR)).resolves.toEqual({
      id: 'p1',
      nome: 'Principal',
      mesas: [{ id: 'mesa-1' }],
      zonas: [{ id: 'z1', nome: 'Zona', cor: '#fff', x: 10, y: 10, w: 20, h: 20 }],
      version: 3,
    });
  });

  it('obter aceita o formato legado (array só de mesas)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({ documento: [{ id: 'mesa-1' }] }),
    );

    await expect(service.obter('evt1', 'p1', ORGANIZADOR)).resolves.toEqual(
      expect.objectContaining({
        mesas: [{ id: 'mesa-1' }],
        zonas: [],
        version: 0,
      }),
    );
  });

  it('obter trata documento não-array/não-objeto como vazio', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha({ documento: null }));

    await expect(service.obter('evt1', 'p1', ORGANIZADOR)).resolves.toEqual(
      expect.objectContaining({ mesas: [], zonas: [], version: 0 }),
    );
  });

  it('obter → 404 se a planta não existir no evento', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);

    await expect(service.obter('evt1', 'inexistente', ORGANIZADOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('obter → 404 se o evento não existir', async () => {
    mockEventService.findOne.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(service.obter('naoexiste', 'p1', ORGANIZADOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mockFloorPlanRepository.findOne).not.toHaveBeenCalled();
  });

  it('guardar com version correcta grava o documento e incrementa a version', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({ documento: { mesas: [], zonas: [] }, version: 3 }),
    );

    await expect(
      service.guardar('evt1', 'p1', ORGANIZADOR, {
        mesas: [{ id: 'mesa-1' }],
        zonas: [],
        version: 3,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'p1',
        mesas: [{ id: 'mesa-1' }],
        zonas: [],
        version: 4,
      }),
    );
    expect(mockFloorPlanRepository.save).toHaveBeenCalled();
  });

  it('guardar aceita payload sem zonas (compatibilidade)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha({ version: 0 }));

    await expect(
      service.guardar('evt1', 'p1', ORGANIZADOR, { mesas: [], version: 0 } as any),
    ).resolves.toEqual(expect.objectContaining({ mesas: [], zonas: [], version: 1 }));
  });

  it('guardar faz clamp da zona para caber em 0-100', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha());

    const resultado = await service.guardar('evt1', 'p1', ORGANIZADOR, {
      mesas: [],
      zonas: [{ id: 'z1', nome: 'Zona', cor: '#fff', x: 90, y: 80, w: 30, h: 40 }],
      version: 0,
    } as any);

    expect(resultado.zonas).toEqual([
      { id: 'z1', nome: 'Zona', cor: '#fff', x: 70, y: 60, w: 30, h: 40 },
    ]);
  });

  it('guardar com version desactualizada → 409 com o estado actual', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: { mesas: [{ id: 'mesa-antiga' }], zonas: [] },
        version: 5,
      }),
    );

    const erro = await service
      .guardar('evt1', 'p1', ORGANIZADOR, { mesas: [{ id: 'mesa-1' }], version: 4 } as any)
      .catch((e: any) => e);

    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.getStatus()).toBe(409);
    expect(erro.getResponse()).toEqual(
      expect.objectContaining({
        mesas: [{ id: 'mesa-antiga' }],
        zonas: [],
        version: 5,
        id: 'p1',
        nome: 'Principal',
      }),
    );
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });

  it('guardar expõe o estado anterior pelo callback (antes de gravar)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: { mesas: [{ id: 'mesa-antiga' }], zonas: [] },
        version: 3,
      }),
    );
    const arquivar = vi.fn();

    await service.guardar(
      'evt1',
      'p1',
      ORGANIZADOR,
      { mesas: [{ id: 'nova' }], zonas: [], version: 3 } as any,
      arquivar,
    );

    expect(arquivar).toHaveBeenCalledWith({
      antes: { mesas: [{ id: 'mesa-antiga' }], zonas: [], dimensoes: null, version: 3 },
      entidadeId: 'p1',
      eventId: 'evt1',
    });
    expect(mockFloorPlanRepository.save).toHaveBeenCalled();
  });

  it('guardar não chama o callback no conflito (409)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha({ version: 5 }));
    const arquivar = vi.fn();

    await expect(
      service.guardar('evt1', 'p1', ORGANIZADOR, { mesas: [], version: 4 } as any, arquivar),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(arquivar).not.toHaveBeenCalled();
  });

  it('guardar grava e devolve as dimensões', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha());

    const resultado = await service.guardar('evt1', 'p1', ORGANIZADOR, {
      mesas: [],
      zonas: [],
      dimensoes: { larguraM: 20.5, alturaM: 12 },
      version: 0,
    } as any);

    expect(resultado.dimensoes).toEqual({ larguraM: 20.5, alturaM: 12 });
    expect(mockFloorPlanRepository.save.mock.calls[0][0].documento.dimensoes).toEqual({
      larguraM: 20.5,
      alturaM: 12,
    });
  });

  it('guardar sem dimensões preserva as existentes', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: { mesas: [], zonas: [], dimensoes: { larguraM: 20, alturaM: 12 } },
        version: 2,
      }),
    );

    const resultado = await service.guardar('evt1', 'p1', ORGANIZADOR, {
      mesas: [{ id: 'm1' }],
      zonas: [],
      version: 2,
    } as any);

    expect(resultado.dimensoes).toEqual({ larguraM: 20, alturaM: 12 });
  });

  it('conflito 409 devolve as dimensões actuais', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: { mesas: [], zonas: [], dimensoes: { larguraM: 15, alturaM: 9 } },
        version: 5,
      }),
    );

    const erro = await service
      .guardar('evt1', 'p1', ORGANIZADOR, { mesas: [], version: 4 } as any)
      .catch((e: any) => e);

    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.getResponse()).toEqual(
      expect.objectContaining({ dimensoes: { larguraM: 15, alturaM: 9 }, version: 5 }),
    );
  });
});

describe('FloorPlanService — renomear e apagar', () => {
  let service: FloorPlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FloorPlanService(
      mockFloorPlanRepository as any,
      mockEventService as any,
    );
    mockEventService.findOne.mockResolvedValue({ id: 'evt1' });
    mockFloorPlanRepository.save.mockImplementation(async (e: any) => e);
    mockFloorPlanRepository.remove.mockImplementation(async (e: any) => e);
  });

  it('renomear muda o nome e arquiva o anterior', async () => {
    mockFloorPlanRepository.findOne
      .mockResolvedValueOnce(novaLinha({ nome: 'Salão' }))
      .mockResolvedValueOnce(null);
    const arquivar = vi.fn();

    await expect(
      service.renomear('evt1', 'p1', ORGANIZADOR, { nome: '  Esplanada ' } as any, arquivar),
    ).resolves.toEqual({ id: 'p1', nome: 'Esplanada', version: 0 });
    expect(arquivar).toHaveBeenCalledWith({
      antes: { id: 'p1', nome: 'Salão', version: 0 },
      entidadeId: 'p1',
      eventId: 'evt1',
    });
    expect(mockFloorPlanRepository.save).toHaveBeenCalled();
  });

  it('renomear → 409 se o nome já estiver noutre planta do evento', async () => {
    mockFloorPlanRepository.findOne
      .mockResolvedValueOnce(novaLinha({ nome: 'Salão' }))
      .mockResolvedValueOnce(novaLinha({ id: 'p2', nome: 'Esplanada' }));

    await expect(
      service.renomear('evt1', 'p1', ORGANIZADOR, { nome: 'Esplanada' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });

  it('renomear → 409 na corrida de unicidade (23505)', async () => {
    mockFloorPlanRepository.findOne
      .mockResolvedValueOnce(novaLinha({ nome: 'Salão' }))
      .mockResolvedValueOnce(null);
    mockFloorPlanRepository.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(
      service.renomear('evt1', 'p1', ORGANIZADOR, { nome: 'Esplanada' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('renomear → 404 se a planta não existir', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);

    await expect(
      service.renomear('evt1', 'inexistente', ORGANIZADOR, { nome: 'Nova' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('apagar remove a planta quando há mais do que uma', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha({ nome: 'Salão' }));
    mockFloorPlanRepository.count.mockResolvedValue(2);
    const arquivar = vi.fn();

    await expect(service.apagar('evt1', 'p1', ORGANIZADOR, arquivar)).resolves.toEqual({
      id: 'p1',
      nome: 'Salão',
      version: 0,
    });
    expect(mockFloorPlanRepository.remove).toHaveBeenCalled();
    expect(arquivar).toHaveBeenCalledWith({
      antes: { id: 'p1', nome: 'Salão', version: 0 },
      entidadeId: 'p1',
      eventId: 'evt1',
    });
  });

  it('apagar → 400 quando é a última planta do evento', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(novaLinha());
    mockFloorPlanRepository.count.mockResolvedValue(1);

    await expect(service.apagar('evt1', 'p1', ORGANIZADOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockFloorPlanRepository.remove).not.toHaveBeenCalled();
  });

  it('apagar → 404 se a planta não existir', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);

    await expect(service.apagar('evt1', 'inexistente', ORGANIZADOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('FloorPlanService — compatibilidade /events/:id/planta ("Principal")', () => {
  let service: FloorPlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FloorPlanService(
      mockFloorPlanRepository as any,
      mockEventService as any,
    );
    mockEventService.findOne.mockResolvedValue({ id: 'evt1' });
    mockFloorPlanRepository.save.mockImplementation(async (e: any) => e);
  });

  it('obterPrincipal devolve a planta "Principal"', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({
        documento: { mesas: [{ id: 'm1' }], zonas: [] },
        version: 7,
      }),
    );

    await expect(service.obterPrincipal('evt1', ORGANIZADOR)).resolves.toEqual({
      mesas: [{ id: 'm1' }],
      zonas: [],
      version: 7,
    });
  });

  it('obterPrincipal devolve vazio na versão 0 quando não há plantas', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);

    await expect(service.obterPrincipal('evt1', ORGANIZADOR)).resolves.toEqual({
      mesas: [],
      zonas: [],
      version: 0,
    });
  });

  it('obterPrincipal → 404 se o evento não existir', async () => {
    mockEventService.findOne.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(service.obterPrincipal('naoexiste', ORGANIZADOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('guardarPrincipal cria a linha "Principal" quando não existe (version 0)', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);
    const linha = novaLinha({ nome: 'Principal', version: 1 });
    mockFloorPlanRepository.create.mockReturnValue(linha);

    await expect(
      service.guardarPrincipal('evt1', ORGANIZADOR, {
        mesas: [{ id: 'm1' }],
        zonas: [],
        version: 0,
      } as any),
    ).resolves.toEqual({ mesas: [{ id: 'm1' }], zonas: [], version: 1 });
    expect(mockFloorPlanRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Principal', version: 1 }),
    );
  });

  it('guardarPrincipal grava na linha existente e incrementa a version', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({ documento: { mesas: [], zonas: [] }, version: 3 }),
    );
    const arquivar = vi.fn();

    await expect(
      service.guardarPrincipal(
        'evt1',
        ORGANIZADOR,
        { mesas: [{ id: 'n1' }], zonas: [], version: 3 } as any,
        arquivar,
      ),
    ).resolves.toEqual({ mesas: [{ id: 'n1' }], zonas: [], version: 4 });
    expect(arquivar).toHaveBeenCalledWith({
      antes: { mesas: [], zonas: [], dimensoes: null, version: 3 },
      eventId: 'evt1',
    });
    expect(mockFloorPlanRepository.create).not.toHaveBeenCalled();
  });

  it('guardarPrincipal sem linha e com version != 0 → 409 com o estado vazio', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(null);

    const erro = await service
      .guardarPrincipal('evt1', ORGANIZADOR, { mesas: [], version: 5 } as any)
      .catch((e: any) => e);

    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.getResponse()).toEqual(
      expect.objectContaining({ mesas: [], zonas: [], version: 0 }),
    );
    expect(mockFloorPlanRepository.create).not.toHaveBeenCalled();
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });

  it('guardarPrincipal com version desactualizada → 409 com o estado actual', async () => {
    mockFloorPlanRepository.findOne.mockResolvedValue(
      novaLinha({ documento: { mesas: [{ id: 'antiga' }], zonas: [] }, version: 5 }),
    );

    const erro = await service
      .guardarPrincipal('evt1', ORGANIZADOR, { mesas: [], version: 4 } as any)
      .catch((e: any) => e);

    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.getResponse()).toEqual(
      expect.objectContaining({ mesas: [{ id: 'antiga' }], version: 5 }),
    );
    expect(mockFloorPlanRepository.save).not.toHaveBeenCalled();
  });
});

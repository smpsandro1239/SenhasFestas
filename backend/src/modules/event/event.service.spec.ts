import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';

const mockEventRepository = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
};

const mockEventUserRepository = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  delete: vi.fn(),
  remove: vi.fn(),
};

const mockOrderRepository = {
  count: vi.fn(),
};

const mockCashClosureRepository = {
  count: vi.fn(),
};

const mockBalanceRepository = {
  findOne: vi.fn(),
  find: vi.fn(),
  remove: vi.fn(),
};

const mockAuditService = {
  record: vi.fn().mockResolvedValue(undefined),
};

const ORGANIZADOR = { id: 'organizador', role: 'organizer' } as any;
const SUPERADMIN = { id: 'super', role: 'superadmin' } as any;

describe('EventService — atribuição de funções (membership)', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
    mockEventRepository.findOne.mockResolvedValue({ id: 'eventoX' });
    mockEventUserRepository.findOne
      .mockResolvedValueOnce({ role: 'organizer' })
      .mockResolvedValue(null);
    mockEventUserRepository.create.mockReturnValue({});
    mockEventUserRepository.save.mockResolvedValue({});
  });

  it('rejeita atribuir superadmin a um membro (mesmo vindo do service, à prova de DTO)', async () => {
    await expect(
      service.addMember('eventoX', ORGANIZADOR, { userId: 'cliente', role: 'superadmin' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('organizador não-superadmin não pode atribuir organizer', async () => {
    await expect(
      service.addMember('eventoX', ORGANIZADOR, { userId: 'outro', role: 'organizer' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('superadmin pode atribuir organizer', async () => {
    mockEventUserRepository.create.mockReturnValue({ role: 'organizer', user: { id: 'outro' } });
    mockEventUserRepository.save.mockResolvedValue({ role: 'organizer' });
    await expect(
      service.addMember('eventoX', SUPERADMIN, { userId: 'outro', role: 'organizer' } as any),
    ).resolves.toBeDefined();
  });

  it('organizador pode atribuir cashier (função inferior)', async () => {
    mockEventUserRepository.create.mockReturnValue({ role: 'cashier' });
    mockEventUserRepository.save.mockResolvedValue({ role: 'cashier' });
    await expect(
      service.addMember('eventoX', ORGANIZADOR, { userId: 'caixa', role: 'cashier' } as any),
    ).resolves.toBeDefined();
  });
});

describe('EventService — autoCloseExpired (janela de datas)', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
  });

  const eventoAtivo = (endDate: string) => ({
    id: 'eventoY',
    status: 'active',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date(endDate),
  });

  it('fecha evento cujo endDate já passou (idempotente e audita apenas 1x)', async () => {
    mockEventRepository.find.mockResolvedValue([eventoAtivo('2026-09-07T00:00:00Z')]);
    mockEventRepository.update.mockResolvedValue({ affected: 1 });

    const fechados = await service.autoCloseExpired(new Date('2026-09-10T12:00:00Z'));

    expect(fechados).toBe(1);
    expect(mockEventRepository.update).toHaveBeenCalledWith(
      { id: 'eventoY', status: 'active' },
      { status: 'closed' },
    );
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS',
        entity: 'event',
        entityId: 'eventoY',
        actorRole: 'system',
        after: { status: 'closed' },
      }),
    );
  });

  it('não audita nem conta quando o UPDATE condicional não afeta linhas (corrida cron+lazy)', async () => {
    mockEventRepository.find.mockResolvedValue([eventoAtivo('2026-09-07T00:00:00Z')]);
    mockEventRepository.update.mockResolvedValue({ affected: 0 });

    const fechados = await service.autoCloseExpired(new Date('2026-09-10T12:00:00Z'));

    expect(fechados).toBe(0);
    expect(mockAuditService.record).not.toHaveBeenCalled();
  });

  it('não fecha eventos ainda dentro da janela', async () => {
    mockEventRepository.find.mockResolvedValue([eventoAtivo('2026-09-07T00:00:00Z')]);
    const fechados = await service.autoCloseExpired(new Date('2026-09-06T23:00:00Z'));
    expect(fechados).toBe(0);
    expect(mockEventRepository.update).not.toHaveBeenCalled();
  });

  it('fecha com now real um evento cuja endDate já passou', async () => {
    mockEventRepository.find.mockResolvedValue([eventoAtivo('2026-09-07T00:00:00Z')]);
    mockEventRepository.update.mockResolvedValue({ affected: 1 });

    const fechados = await service.autoCloseExpired();

    expect(fechados).toBe(1);
    expect(mockEventRepository.update).toHaveBeenCalledWith(
      { id: 'eventoY', status: 'active' },
      { status: 'closed' },
    );
  });
});

describe('EventService — assertEventOperavel (guard de janela)', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
  });

  const evento = (status: string, endDate = '2026-10-31T00:00:00Z') => ({
    id: 'eventoZ',
    status,
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date(endDate),
  });

  const NOW = new Date('2026-09-15T12:00:00Z');

  it('lança para draft', async () => {
    await expect(service.assertEventOperavel(evento('draft') as any, NOW)).rejects.toThrow(
      'Evento ainda não está ativo',
    );
  });

  it('lança para closed', async () => {
    await expect(service.assertEventOperavel(evento('closed') as any, NOW)).rejects.toThrow(
      'Evento encerrado',
    );
  });

  it('fecha e lança quando a janela terminou (lazy check)', async () => {
    mockEventRepository.update.mockResolvedValue({ affected: 1 });
    const expirado = evento('active', '2026-09-10T00:00:00Z');
    await expect(
      service.assertEventOperavel(expirado as any, NOW),
    ).rejects.toThrow('terminou');
    expect(mockEventRepository.update).toHaveBeenCalledWith(
      { id: 'eventoZ', status: 'active' },
      { status: 'closed' },
    );
    expect(mockAuditService.record).toHaveBeenCalledTimes(1);
  });

  it('lança para evento futuro SEM fechar (janela futura não é expiração)', async () => {
    const futuro = {
      id: 'eventoZ',
      status: 'active',
      startDate: new Date('2026-10-02T00:00:00Z'),
      endDate: new Date('2026-10-04T00:00:00Z'),
    };
    await expect(
      service.assertEventOperavel(futuro as any, new Date('2026-09-30T00:00:00Z')),
    ).rejects.toThrow('ainda não começou');
    expect(mockEventRepository.update).not.toHaveBeenCalled();
    expect(mockAuditService.record).not.toHaveBeenCalled();
  });

  it('permite ativo dentro da janela', async () => {
    await expect(
      service.assertEventOperavel(evento('active') as any, NOW),
    ).resolves.toBeUndefined();
    expect(mockEventRepository.update).not.toHaveBeenCalled();
  });
});

describe('EventService — updateStatus: não reabrir com data passada', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
  });

  const eventoExpirado = {
    id: 'eventoW',
    status: 'closed',
    startDate: new Date('2026-08-01T00:00:00Z'),
    endDate: new Date('2026-09-10T00:00:00Z'),
  };

  it('bloqueia reabrir quando endDate passou', async () => {
    mockEventRepository.findOne.mockResolvedValue(eventoExpirado);
    mockEventUserRepository.findOne.mockResolvedValue({ role: 'organizer' });
    await expect(
      service.updateStatus('eventoW', ORGANIZADOR, 'active'),
    ).rejects.toThrow('Não é possível reabrir o evento');
    expect(mockEventRepository.save).not.toHaveBeenCalled();
  });
});

describe('EventService — shortCode do evento', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
    mockEventRepository.find.mockResolvedValue([]);
    mockEventRepository.create.mockImplementation((data: any) => data);
    mockEventRepository.save.mockImplementation(async (e: any) => ({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ...e,
    }));
  });

  const DADOS = {
    name: 'Magusto de Vila 2026',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-03T00:00:00Z',
  } as any;

  it('cria derivando o shortCode do name', async () => {
    const ev = await service.create(SUPERADMIN, DADOS);
    expect(ev.shortCode).toBe('magusto-de-vila-2026');
  });

  it('sufixa -2 quando a base já está em uso', async () => {
    mockEventRepository.find.mockResolvedValue([{ shortCode: 'magusto-de-vila-2026' }]);
    const ev = await service.create(SUPERADMIN, DADOS);
    expect(ev.shortCode).toBe('magusto-de-vila-2026-2');
  });

  it('cria com shortCode explícito normalizado', async () => {
    const ev = await service.create(SUPERADMIN, { ...DADOS, shortCode: 'Festa  do Bar' });
    expect(ev.shortCode).toBe('festa-do-bar');
  });

  it('recusa shortCode explícito duplicado (409)', async () => {
    mockEventRepository.find.mockResolvedValue([{ shortCode: 'festa-do-bar' }]);
    await expect(
      service.create(SUPERADMIN, { ...DADOS, shortCode: 'festa-do-bar' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('recusa shortCode explícito inválido (400)', async () => {
    await expect(
      service.create(SUPERADMIN, { ...DADOS, shortCode: 'ab' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockEventRepository.save).not.toHaveBeenCalled();
  });

  it('update normaliza o shortCode recebido', async () => {
    mockEventRepository.findOne.mockResolvedValue({ id: 'evt1', shortCode: 'antigo' });
    mockEventUserRepository.findOne.mockResolvedValue({ role: 'organizer' });
    mockEventRepository.find.mockResolvedValue([{ shortCode: 'antigo' }]);

    const ev = await service.update('evt1', ORGANIZADOR, {
      shortCode: 'Magusto de Vila 2026',
    } as any);

    expect(ev.shortCode).toBe('magusto-de-vila-2026');
    expect(mockEventRepository.save).toHaveBeenCalled();
  });

  it('update recusa shortCode ocupado por outro evento (409)', async () => {
    mockEventRepository.findOne.mockResolvedValue({ id: 'evt1', shortCode: 'antigo' });
    mockEventUserRepository.findOne.mockResolvedValue({ role: 'organizer' });
    mockEventRepository.find.mockResolvedValue([
      { shortCode: 'antigo' },
      { shortCode: 'ocupado' },
    ]);

    await expect(
      service.update('evt1', ORGANIZADOR, { shortCode: 'ocupado' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mockEventRepository.save).not.toHaveBeenCalled();
  });

  it('update mantém o próprio shortCode sem erro de colisão', async () => {
    mockEventRepository.findOne.mockResolvedValue({ id: 'evt1', shortCode: 'antigo' });
    mockEventUserRepository.findOne.mockResolvedValue({ role: 'organizer' });
    mockEventRepository.find.mockResolvedValue([{ shortCode: 'antigo' }]);

    await expect(
      service.update('evt1', ORGANIZADOR, { shortCode: 'antigo' } as any),
    ).resolves.toEqual(expect.objectContaining({ shortCode: 'antigo' }));
    expect(mockEventRepository.save).toHaveBeenCalled();
  });

  it('update recusa shortCode inválido (400)', async () => {
    mockEventRepository.findOne.mockResolvedValue({ id: 'evt1', shortCode: 'antigo' });
    mockEventUserRepository.findOne.mockResolvedValue({ role: 'organizer' });

    await expect(
      service.update('evt1', ORGANIZADOR, { shortCode: '??' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockEventRepository.save).not.toHaveBeenCalled();
  });

  it('findByCode devolve só {id, name, shortCode}', async () => {
    mockEventRepository.findOne.mockResolvedValue({
      id: 'evt1',
      name: 'Magusto',
      shortCode: 'magusto-2026',
      settings: { currency: 'EUR' },
    });

    const r = await service.findByCode('magusto-2026');

    expect(r).toEqual({ id: 'evt1', name: 'Magusto', shortCode: 'magusto-2026' });
    expect(mockEventRepository.findOne).toHaveBeenCalledWith({
      where: { shortCode: 'magusto-2026' },
    });
  });

  it('findByCode devolve 404 para código inexistente', async () => {
    mockEventRepository.findOne.mockResolvedValue(null);
    await expect(service.findByCode('naoexiste')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findByCode normaliza o código recebido do URL', async () => {
    mockEventRepository.findOne.mockResolvedValue(null);
    await expect(service.findByCode('Magusto 2026')).rejects.toBeInstanceOf(NotFoundException);
    expect(mockEventRepository.findOne).toHaveBeenCalledWith({
      where: { shortCode: 'magusto-2026' },
    });
  });

});

describe('EventService — entrar no evento (eventCode)', () => {
  let service: EventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventService(
      mockEventRepository as any,
      mockEventUserRepository as any,
      mockOrderRepository as any,
      mockCashClosureRepository as any,
      mockAuditService as any,
      mockBalanceRepository as any,
    );
    mockEventRepository.findOne.mockResolvedValue({
      id: 'evt2',
      name: 'Festa',
      shortCode: 'festa',
    });
    mockEventUserRepository.findOne.mockResolvedValue(null);
    mockEventUserRepository.create.mockImplementation((data: any) => data);
    mockEventUserRepository.save.mockImplementation(async (data: any) => ({
      id: 'eu-novo',
      ...data,
    }));
    mockEventUserRepository.find.mockResolvedValue([]);
    mockBalanceRepository.findOne.mockResolvedValue(null);
    mockEventUserRepository.remove.mockResolvedValue(undefined);
  });

  it('sem replace cria o vínculo e devolve {eventId, eventName, replaces: 0}', async () => {
    const r = await service.entrar('user1', 'festa', false);

    expect(r).toEqual({ eventId: 'evt2', eventName: 'Festa', replaces: 0 });
    expect(mockEventUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'client' }),
    );
    expect(mockBalanceRepository.findOne).not.toHaveBeenCalled();
  });

  it('já membro não duplica o vínculo', async () => {
    mockEventUserRepository.findOne.mockResolvedValue({ id: 'eu-existente' });

    const r = await service.entrar('user1', 'festa', false);

    expect(r).toEqual({ eventId: 'evt2', eventName: 'Festa', replaces: 0 });
    expect(mockEventUserRepository.create).not.toHaveBeenCalled();
    expect(mockEventUserRepository.save).not.toHaveBeenCalled();
  });

  it('replace com saldo positivo noutro evento → 409 nomeando o evento bloqueante', async () => {
    mockBalanceRepository.findOne.mockResolvedValue({
      id: 'b1',
      currentBalance: 12.5,
      event: { id: 'evt1', name: 'Magusto' },
    });

    const erro = await service.entrar('user1', 'festa', true).catch((e: any) => e);

    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.message).toContain('Magusto');
    expect(mockEventUserRepository.remove).not.toHaveBeenCalled();
    expect(mockEventUserRepository.save).not.toHaveBeenCalled();
  });

  it('replace sem saldo remove os memberships anteriores e devolve replaces', async () => {
    const anteriores = [{ id: 'eu-old1' }, { id: 'eu-old2' }];
    mockEventUserRepository.find.mockResolvedValue(anteriores);

    const r = await service.entrar('user1', 'festa', true);

    expect(r).toEqual({ eventId: 'evt2', eventName: 'Festa', replaces: 2 });
    expect(mockBalanceRepository.findOne).toHaveBeenCalled();
    expect(mockEventUserRepository.remove).toHaveBeenCalledWith(anteriores);
    expect(mockEventUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'client' }),
    );
  });

  it('código desconhecido → 404', async () => {
    mockEventRepository.findOne.mockResolvedValue(null);
    await expect(service.entrar('user1', 'naoexiste', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
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
};

const mockOrderRepository = {
  count: vi.fn(),
};

const mockCashClosureRepository = {
  count: vi.fn(),
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
    );
  });

  const evento = (status: string, endDate = '2026-10-31T00:00:00Z') => ({
    id: 'eventoZ',
    status,
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date(endDate),
  });

  it('lança para draft antes do início da janela', async () => {
    await expect(service.assertEventOperavel(evento('draft') as any)).rejects.toThrow(
      'Evento ainda não está ativo',
    );
  });

  it('lança para closed', async () => {
    await expect(service.assertEventOperavel(evento('closed') as any)).rejects.toThrow(
      'Evento encerrado',
    );
  });

  it('fecha e lança quando a janela terminou (lazy check)', async () => {
    mockEventRepository.update.mockResolvedValue({ affected: 1 });
    const expirado = evento('active', '2026-09-20T00:00:00Z');
    await expect(
      service.assertEventOperavel(expirado as any),
    ).rejects.toThrow('terminou');
    expect(mockEventRepository.update).toHaveBeenCalledWith(
      { id: 'eventoZ', status: 'active' },
      { status: 'closed' },
    );
    expect(mockAuditService.record).toHaveBeenCalledTimes(1);
  });

  it('permite ativo dentro da janela', async () => {
    await expect(service.assertEventOperavel(evento('active') as any)).resolves.toBeUndefined();
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
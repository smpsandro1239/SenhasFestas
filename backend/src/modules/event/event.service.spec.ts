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
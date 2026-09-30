import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MembershipService } from './membership.service';

// Política 2A (decidida): role efetiva dentro do evento = event-role, exceto
// superadmin global (imune). A aplicação da política vive no RolesGuard — ver
// roles.guard.spec.ts. Este ficheiro cobre só o contrato do MembershipService.

describe('MembershipService — comportamento do event-role', () => {
  const mockEventUserRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
  };
  let service: MembershipService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MembershipService(mockEventUserRepository as any);
  });

  it('assertMember resolve com qualquer event-role (organizer global passa com role client no evento)', async () => {
    mockEventUserRepository.findOne.mockResolvedValue({
      id: 'm1',
      role: 'client',
      user: { id: 'u1' },
    });

    await expect(
      service.assertMember({ id: 'u1', role: 'organizer' }, 'evt1'),
    ).resolves.toBeUndefined();
  });

  it('roleEfetiva: com eventId usa a event-role do evento', async () => {
    mockEventUserRepository.findOne.mockResolvedValue({
      id: 'm1',
      role: 'cashier',
      user: { id: 'u1' },
    });

    await expect(
      service.roleEfetiva({ id: 'u1', role: 'organizer' }, 'evt1'),
    ).resolves.toBe('cashier');
  });

  it('roleEfetiva: superadmin é imune e nunca consulta a BD', async () => {
    const repo = vi.mocked(mockEventUserRepository);

    await expect(
      service.roleEfetiva({ id: 'u1', role: 'superadmin' }, 'evt1'),
    ).resolves.toBe('superadmin');

    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.find).not.toHaveBeenCalled();
  });
});
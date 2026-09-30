import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MembershipService } from './membership.service';

// TODO(B3): política do papel por evento (EventUserEntity.role) ainda não
// decidida. Este ficheiro documenta o comportamento ATUAL (event-role ignorado),
// não uma política desejada. Decisão pendente do utilizador — ver thread de
// revisão: teto, piso, global vence, hierárquico, só-leitura ou remover da UI.

describe('MembershipService — comportamento atual do event-role', () => {
  const mockEventUserRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
  };
  let service: MembershipService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MembershipService(mockEventUserRepository as any);
  });

  it('documenta: assertMember ignora o event-role (organizer global passa com role client no evento)', async () => {
    mockEventUserRepository.findOne.mockResolvedValue({
      id: 'm1',
      role: 'client',
      user: { id: 'u1' },
    });

    await expect(
      service.assertMember({ id: 'u1', role: 'organizer' }, 'evt1'),
    ).resolves.toBeUndefined();
  });

  it.todo('B3: IMPORTA teto — organizer global com event-role client deve ser rejeitado');
});
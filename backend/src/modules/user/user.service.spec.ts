import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

const mockUserRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
};

const mockEventUserRepository = {
  find: vi.fn(),
};

const mockMembershipService = {
  eventIdsFor: vi.fn(),
};

const UTILIZADOR_PUBLICO = {
  id: 'u1',
  email: 'client@senhasfestas.com',
  name: 'Cliente',
  role: 'client',
  accessCode: '123456',
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService(
      mockUserRepository as any,
      mockEventUserRepository as any,
      mockMembershipService as any,
    );
  });

  describe('create', () => {
    it('rejeita criação de superadmin por ator não-superadmin', async () => {
      await expect(
        service.create(
          {
            email: 'x@example.com',
            password: 'pass1234',
            name: 'X',
            role: 'superadmin',
          },
          { id: 'organizer', role: 'organizer' } as any,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite criação de superadmin por um superadmin', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 'u2' });
      mockUserRepository.save.mockResolvedValue({ id: 'u2', role: 'superadmin' });

      await expect(
        service.create(
          {
            email: 'x@example.com',
            password: 'pass1234',
            name: 'X',
            role: 'superadmin',
          },
          { id: 'boss', role: 'superadmin' } as any,
        ),
      ).resolves.toBeDefined();
    });

    it('permite criação de roles staff por ator não-superadmin (guarda de rota é MANAGEMENT)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 'u3' });
      mockUserRepository.save.mockResolvedValue({ id: 'u3', role: 'organizer' });

      await expect(
        service.create(
          { email: 'y@example.com', password: 'pass1234', name: 'Y', role: 'organizer' },
          { id: 'organizer', role: 'organizer' } as any,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('findByAccessCode', () => {
    it('devolve o utilizador por código exato quando sem scope', async () => {
      mockUserRepository.findOne.mockResolvedValue(UTILIZADOR_PUBLICO);
      mockMembershipService.eventIdsFor.mockResolvedValue(null);

      await expect(service.findByAccessCode('123456')).resolves.toEqual(UTILIZADOR_PUBLICO);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accessCode: '123456' } }),
      );
    });

    it('rejeita códigos que não sejam 6 dígitos', async () => {
      await expect(service.findByAccessCode('12')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.findByAccessCode('12345a')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devolve 404 quando o código não existe', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findByAccessCode('654321')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devolve 404 quando o utilizador não é membro do scope do operador', async () => {
      mockUserRepository.findOne.mockResolvedValue(UTILIZADOR_PUBLICO);
      mockMembershipService.eventIdsFor.mockResolvedValue(['evt1']);
      mockEventUserRepository.find.mockResolvedValue([{ user: { id: 'outro' } }]);

      await expect(service.findByAccessCode('123456', { id: 'staff' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('devolve o utilizador quando é membro do scope do operador', async () => {
      mockUserRepository.findOne.mockResolvedValue(UTILIZADOR_PUBLICO);
      mockMembershipService.eventIdsFor.mockResolvedValue(['evt1']);
      mockEventUserRepository.find.mockResolvedValue([{ user: { id: 'u1' } }]);

      await expect(
        service.findByAccessCode('123456', { id: 'staff', role: 'cashier' }),
      ).resolves.toEqual(UTILIZADOR_PUBLICO);
    });
  });
});
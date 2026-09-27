import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const mockRepository = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn().mockReturnValue('signed-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockRepository as any, mockRepository as any, mockJwtService as any);
  });

  describe('login', () => {
    it('returns token and user without password on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      const user = {
        id: 'u1',
        email: 'client@test.com',
        password: passwordHash,
        name: 'Client',
        role: 'client',
        isActive: true,
      };
      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.login('client@test.com', 'secret123');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'client@test.com', role: 'client' },
        { issuer: 'senhasfestas-api', audience: 'senhasfestas-app' },
      );
      expect(result.token).toBe('signed-token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.role).toBe('client');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login('missing@test.com', 'secret123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      mockRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'client@test.com',
        password: passwordHash,
        role: 'client',
        isActive: true,
      });

      await expect(
        service.login('client@test.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive (mensagem genérica, sem enumerar estado)', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'u2',
        email: 'inactive@test.com',
        password: 'hash',
        role: 'client',
        isActive: false,
      });

      await expect(
        service.login('inactive@test.com', 'secret123'),
      ).rejects.toThrow('Credenciais inválidas');
    });
  });

  describe('register', () => {
    it('creates a user with role client and hashed password', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: any) => data);
      mockRepository.save.mockImplementation(async (data: any) => ({
        id: 'u3',
        ...data,
      }));

      const result = await service.register(
        'new@test.com',
        'secret123',
        'New User',
        'client',
      );

      const created = mockRepository.create.mock.calls[0][0];
      expect(created.role).toBe('client');
      expect(created.isActive).toBe(true);
      expect(created.password).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', created.password)).toBe(true);
      expect(result).not.toHaveProperty('password');
    });

    it('throws when email is already in use', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 'u1' });

      await expect(
        service.register('taken@test.com', 'secret123', 'Taken', 'client'),
      ).rejects.toThrow('Email já em uso');
    });
  });

  describe('refresh', () => {
    const activeUser = {
      id: 'u1',
      email: 'client@test.com',
      name: 'Client',
      role: 'client',
      isActive: true,
    };

    const validToken = {
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: undefined,
      isUsed: false,
    };

    it('rotates a valid token and returns a new pair', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.create.mockImplementation((data: any) => data);
      mockRepository.save.mockImplementation(async (data: any) => ({ id: 'rt2', ...data }));
      mockRepository.findOne.mockResolvedValueOnce(validToken).mockResolvedValueOnce(activeUser);

      const result = await service.refresh('raw-token');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'rt1', revokedAt: IsNull(), isUsed: false },
        { revokedAt: expect.any(Date), isUsed: true },
      );
      expect(result.token).toBe('signed-token');
      expect(result.user.role).toBe('client');
      expect(result.user).not.toHaveProperty('password');
    });

    it('returns Username when presented an already-used token with no successor', async () => {
      const usedToken = {
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        isUsed: true,
      };
      mockRepository.findOne.mockResolvedValue(usedToken);
      let calls = 0;
      mockRepository.findOne.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return usedToken;
        return null;
      });

      await expect(service.refresh('raw-token')).rejects.toThrow(UnauthorizedException);
    });

    it('follows the rotation chain when the presented token was already replaced', async () => {
      const usedToken = {
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'old-hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        isUsed: true,
      };
      const successor = {
        id: 'rt2',
        userId: 'u1',
        tokenHash: 'new-hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: undefined,
        isUsed: false,
        replacedByTokenId: 'rt1',
      };
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.create.mockImplementation((data: any) => data);
      mockRepository.save.mockImplementation(async (data: any) => ({ id: 'rt3', ...data }));
      let calls = 0;
      mockRepository.findOne.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return usedToken;
        if (calls === 2) return successor;
        return activeUser;
      });

      const result = await service.refresh('raw-token');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'rt2', revokedAt: IsNull(), isUsed: false },
        { revokedAt: expect.any(Date), isUsed: true },
      );
      expect(result.token).toBe('signed-token');
      expect(result.user.role).toBe('client');
    });
  });

  describe('validateUser', () => {
    it('returns the active user', async () => {
      const user = { id: 'u1', isActive: true };
      mockRepository.findOne.mockResolvedValue(user);

      await expect(
        service.validateUser({ sub: 'u1', email: 'e@t.com', role: 'client' }),
      ).resolves.toEqual(user);
    });

    it('throws when user is missing or inactive', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.validateUser({ sub: 'u1', email: 'e@t.com', role: 'client' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const mockRepository = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn().mockReturnValue('signed-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockRepository as any, mockJwtService as any);
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

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'client@test.com',
        role: 'client',
      });
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

    it('throws UnauthorizedException when user is inactive', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'u2',
        email: 'inactive@test.com',
        password: 'hash',
        role: 'client',
        isActive: false,
      });

      await expect(
        service.login('inactive@test.com', 'secret123'),
      ).rejects.toThrow('User inactive');
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
      ).rejects.toThrow('Email already in use');
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
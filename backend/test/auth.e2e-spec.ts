import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserEntity, RefreshTokenEntity } from '../src/entities';
import { JwtService } from '@nestjs/jwt';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn(() => 'test-token'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return access token when login is successful', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const result = {
        token: 'test-token',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'test@example.com' },
      };

      vi.spyOn(service, 'login').mockResolvedValue(result);

      await expect(controller.login(loginDto)).resolves.toEqual(result);
      expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens', async () => {
      const result = {
        token: 'new-token',
        refreshToken: 'refresh-2',
        user: { id: '1', email: 'test@example.com' },
      };

      vi.spyOn(service, 'refresh').mockResolvedValue(result);

      await expect(controller.refresh({ refreshToken: 'refresh-1' })).resolves.toEqual(result);
    });
  });
});
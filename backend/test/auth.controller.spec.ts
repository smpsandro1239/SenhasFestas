import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthController, LoginDto, RegisterDto } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserEntity, RefreshTokenEntity } from '../src/entities';
import { EventService } from '../src/modules/event/event.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../src/modules/user/dto';

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
        {
          provide: EventService,
          useValue: {
            findByCode: vi.fn(),
            vincularCliente: vi.fn(),
            entrar: vi.fn(),
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
    it('devolve token+user e define cookies httpOnly (access + refresh)', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const result = {
        token: 'test-token',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'test@example.com' },
      };

      vi.spyOn(service, 'login').mockResolvedValue(result);

      const req = { secure: false, get: () => undefined, headers: {}, cookies: {} };
      const res = { cookie: vi.fn(), clearCookie: vi.fn() };

      await expect(controller.login(req as any, res as any, loginDto)).resolves.toEqual({
        token: 'test-token',
        user: result.user,
      });
      expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(res.cookie).toHaveBeenCalledWith('sf_token', 'test-token', expect.objectContaining({ httpOnly: true }));
      expect(res.cookie).toHaveBeenCalledWith('sf_refresh', 'refresh-1', expect.objectContaining({ httpOnly: true }));
      expect(JSON.stringify(await controller.login(req as any, res as any, loginDto))).not.toContain('refreshToken');
    });

    it('grava cookies host-only (sem Domain) — contrato same-origin via rewrite', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const result = {
        token: 'test-token',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'test@example.com' },
      };
      vi.spyOn(service, 'login').mockResolvedValue(result);

      const req = { secure: false, get: () => undefined, headers: {}, cookies: {} };
      const res = { cookie: vi.fn(), clearCookie: vi.fn() };

      await controller.login(req as any, res as any, loginDto);
      for (const call of res.cookie.mock.calls) {
        expect(call[2]).not.toHaveProperty('domain');
      }
    });
  });

  describe('enter-event', () => {
    it('delega para authService.entrar com replace=false por omissão', async () => {
      vi.spyOn(service, 'entrar').mockResolvedValue({
        eventId: 'e1',
        eventName: 'Festa',
        replaces: 0,
      });

      const req = { user: { id: 'u1' } };

      await expect(controller.enterEvent(req as any, { eventCode: 'festa' })).resolves.toEqual({
        eventId: 'e1',
        eventName: 'Festa',
        replaces: 0,
      });
      expect(service.entrar).toHaveBeenCalledWith({ id: 'u1' }, 'festa', false);
    });
  });

  describe('refresh', () => {
    it('roda refresh com cookie httpOnly, roda tokens e não expõe refreshToken no body', async () => {
      const result = {
        token: 'new-token',
        refreshToken: 'refresh-2',
        user: { id: '1', email: 'test@example.com' },
      };

      vi.spyOn(service, 'refresh').mockResolvedValue(result);

      const req = { secure: false, get: () => undefined, headers: {}, cookies: { sf_refresh: 'refresh-1' } };
      const res = { cookie: vi.fn(), clearCookie: vi.fn() };

      await expect(controller.refresh(req as any, res as any)).resolves.toEqual({
        token: 'new-token',
        user: result.user,
      });
      expect(service.refresh).toHaveBeenCalledWith('refresh-1');
      expect(res.cookie).toHaveBeenCalledWith('sf_token', 'new-token', expect.objectContaining({ httpOnly: true }));
      expect(res.cookie).toHaveBeenCalledWith('sf_refresh', 'refresh-2', expect.objectContaining({ httpOnly: true }));
    });
  });

  describe('Password DTO validation (bcrypt 72-byte max limit & DoS prevention)', () => {
    it('rejeita LoginDto com password > 72 caracteres', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'a'.repeat(73),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('aceita LoginDto com password de 72 caracteres', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'a'.repeat(72),
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'password')).toEqual([]);
    });

    it('rejeita RegisterDto com password > 72 caracteres', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        name: 'Teste',
        password: 'a'.repeat(73),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('aceita RegisterDto com password de 72 caracteres', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        name: 'Teste',
        password: 'a'.repeat(72),
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'password')).toEqual([]);
    });

    it('rejeita CreateUserDto com password > 72 caracteres', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'test@example.com',
        name: 'Teste',
        role: 'cashier',
        password: 'a'.repeat(73),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('aceita CreateUserDto com password de 72 caracteres', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'test@example.com',
        name: 'Teste',
        role: 'cashier',
        password: 'a'.repeat(72),
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'password')).toEqual([]);
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserEntity, RefreshTokenEntity } from '../src/entities';
import { EventService } from '../src/modules/event/event.service';
import { JwtService } from '@nestjs/jwt';
import { OrderGateway } from '../src/websocket/order.gateway';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;
  let orderGateway: OrderGateway;

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
        {
          provide: OrderGateway,
          useValue: { revogarAcessoEvento: vi.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
    orderGateway = module.get<OrderGateway>(OrderGateway);
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
        replacedEventIds: [],
      });

      const req = { user: { id: 'u1' } };

      await expect(controller.enterEvent(req as any, { eventCode: 'festa' })).resolves.toEqual({
        eventId: 'e1',
        eventName: 'Festa',
        replaces: 0,
      });
      expect(service.entrar).toHaveBeenCalledWith({ id: 'u1' }, 'festa', false);
      expect(orderGateway.revogarAcessoEvento).not.toHaveBeenCalled();
    });

    it('revoga as rooms dos eventos substituídos sem expor os IDs na resposta', async () => {
      vi.spyOn(service, 'entrar').mockResolvedValue({
        eventId: 'novo-evento',
        eventName: 'Festa nova',
        replaces: 2,
        replacedEventIds: ['evento-antigo-1', 'evento-antigo-2'],
      });

      const req = { user: { id: 'u1' } };

      const resposta = await controller.enterEvent(req as any, {
        eventCode: 'festa-nova',
        replace: true,
      });

      expect(resposta).toEqual({
        eventId: 'novo-evento',
        eventName: 'Festa nova',
        replaces: 2,
      });
      expect(JSON.stringify(resposta)).not.toContain('evento-antigo');
      expect(orderGateway.revogarAcessoEvento).toHaveBeenNthCalledWith(1, 'u1', 'evento-antigo-1');
      expect(orderGateway.revogarAcessoEvento).toHaveBeenNthCalledWith(2, 'u1', 'evento-antigo-2');
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
});
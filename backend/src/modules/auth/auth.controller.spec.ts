import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController — enter-event', () => {
  const authService = { entrar: vi.fn() };
  const orderGateway = { revogarAcessoEvento: vi.fn() };
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(authService as any, orderGateway as any);
  });

  it('revoga as rooms dos eventos substituídos e não expõe os IDs internos', async () => {
    authService.entrar.mockResolvedValue({
      eventId: 'evt-new',
      eventName: 'Festa nova',
      replaces: 2,
      replacedEventIds: ['evt-old-1', 'evt-old-2'],
    });

    const result = await controller.enterEvent(
      { user: { id: 'user-1' } },
      { eventCode: 'festa-nova', replace: true },
    );

    expect(orderGateway.revogarAcessoEvento).toHaveBeenNthCalledWith(1, 'user-1', 'evt-old-1');
    expect(orderGateway.revogarAcessoEvento).toHaveBeenNthCalledWith(2, 'user-1', 'evt-old-2');
    expect(result).toEqual({ eventId: 'evt-new', eventName: 'Festa nova', replaces: 2 });
    expect(result).not.toHaveProperty('replacedEventIds');
  });

  it('não revoga rooms quando não houve substituição de memberships', async () => {
    authService.entrar.mockResolvedValue({
      eventId: 'evt-current',
      eventName: 'Festa actual',
      replaces: 0,
      replacedEventIds: [],
    });

    await controller.enterEvent(
      { user: { id: 'user-1' } },
      { eventCode: 'festa-actual', replace: false },
    );

    expect(orderGateway.revogarAcessoEvento).not.toHaveBeenCalled();
  });
});

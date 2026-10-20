import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';
import { AuthService } from '../auth/auth.service';

describe('CronController', () => {
  let controller: CronController;
  let mockEventService: Partial<EventService>;
  let mockBalanceService: Partial<BalanceService>;
  let mockAuthService: Partial<AuthService>;

  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'secret123';

    mockEventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(2),
    };
    mockBalanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 3, removidos: 1 }),
    };
    mockAuthService = {
      cleanupExpiredTokens: vi.fn().mockResolvedValue(5),
    };

    controller = new CronController(
      mockEventService as EventService,
      mockBalanceService as BalanceService,
      mockAuthService as AuthService,
    );
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it('deve rejeitar se CRON_SECRET não estiver configurado no servidor', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents('Bearer secret123')).rejects.toThrow(ForbiddenException);
  });

  it('deve rejeitar se o token recebido for inválido ou de tamanho diferente', async () => {
    await expect(controller.closeEvents('Bearer errado')).rejects.toThrow(ForbiddenException);
    await expect(controller.closeEvents(undefined, 'curto')).rejects.toThrow(ForbiddenException);
    await expect(controller.closeEvents(undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('deve executar closeEvents quando autorizado por Bearer', async () => {
    const res = await controller.closeEvents('Bearer secret123');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalled();
  });

  it('deve executar archiveBalances quando autorizado por x-cron-secret', async () => {
    const res = await controller.archiveBalances(undefined, 'secret123');
    expect(res).toEqual({ arquivados: 3, removidos: 1 });
    expect(mockBalanceService.archiveExpiredBalances).toHaveBeenCalled();
  });

  it('deve executar cleanupTokens via GET e POST quando autorizado', async () => {
    const resGet = await controller.cleanupTokens('Bearer secret123');
    expect(resGet).toEqual({ removidos: 5 });

    const resPost = await controller.cleanupTokensPost(undefined, 'secret123');
    expect(resPost).toEqual({ removidos: 5 });

    expect(mockAuthService.cleanupExpiredTokens).toHaveBeenCalledTimes(2);
  });
});

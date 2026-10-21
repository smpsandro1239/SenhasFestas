import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let mockEventService: { autoCloseExpired: ReturnType<typeof vi.fn> };
  let mockBalanceService: { archiveExpiredBalances: ReturnType<typeof vi.fn> };
  const envOriginal = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'secret123';
    mockEventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(2),
    };
    mockBalanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 1 }),
    };

    controller = new CronController(
      mockEventService as unknown as EventService,
      mockBalanceService as unknown as BalanceService,
    );
  });

  afterEach(() => {
    if (envOriginal !== undefined) {
      process.env.CRON_SECRET = envOriginal;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it('deve rejeitar pedido se CRON_SECRET não estiver configurado no ambiente', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents('Bearer secret123')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deve rejeitar se o token recebido for incorreto ou tiver tamanho diferente', async () => {
    await expect(controller.closeEvents('Bearer secretERRADO')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.closeEvents(undefined, 'secretERRADO')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deve aceitar autorização por Bearer token no header authorization', async () => {
    const res = await controller.closeEvents('Bearer secret123');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('deve aceitar autorização via header x-cron-secret', async () => {
    const res = await controller.closeEvents(undefined, 'secret123');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('deve executar closeEvents via POST', async () => {
    const res = await controller.closeEventsPost('Bearer secret123');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('deve executar archiveBalances via GET e POST com sucesso', async () => {
    const resGet = await controller.archiveBalances('Bearer secret123');
    expect(resGet).toEqual({ arquivados: 5, removidos: 1 });
    expect(mockBalanceService.archiveExpiredBalances).toHaveBeenCalledTimes(1);

    const resPost = await controller.archiveBalancesPost(undefined, 'secret123');
    expect(resPost).toEqual({ arquivados: 5, removidos: 1 });
    expect(mockBalanceService.archiveExpiredBalances).toHaveBeenCalledTimes(2);
  });
});

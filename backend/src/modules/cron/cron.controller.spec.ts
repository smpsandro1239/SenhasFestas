import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let eventService: EventService;
  let balanceService: BalanceService;
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'super-secret-cron-key-12345';
    eventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(3),
    } as unknown as EventService;
    balanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 2 }),
    } as unknown as BalanceService;

    controller = new CronController(eventService, balanceService);
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.CRON_SECRET = originalSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  describe('closeEvents', () => {
    it('deve fechar eventos com header Authorization Bearer válido', async () => {
      const res = await controller.closeEvents('Bearer super-secret-cron-key-12345');
      expect(res).toEqual({ fechados: 3 });
      expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
    });

    it('deve fechar eventos com header x-cron-secret válido', async () => {
      const res = await controller.closeEvents(undefined, 'super-secret-cron-key-12345');
      expect(res).toEqual({ fechados: 3 });
      expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
    });

    it('deve lançar ForbiddenException se o secret for incorreto ou de tamanho diferente', async () => {
      await expect(controller.closeEvents('Bearer secret-errado')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.closeEvents(undefined, 'outro-tamanho')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve lançar ForbiddenException se nenhum secret for fornecido', async () => {
      await expect(controller.closeEvents()).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar ForbiddenException se CRON_SECRET não estiver configurado no servidor', async () => {
      delete process.env.CRON_SECRET;
      await expect(controller.closeEvents('Bearer super-secret-cron-key-12345')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve delegar a requisição POST para closeEvents', async () => {
      const res = await controller.closeEventsPost('Bearer super-secret-cron-key-12345');
      expect(res).toEqual({ fechados: 3 });
    });
  });

  describe('archiveBalances', () => {
    it('deve arquivar saldos expirados com secret válido', async () => {
      const res = await controller.archiveBalances('Bearer super-secret-cron-key-12345');
      expect(res).toEqual({ arquivados: 5, removidos: 2 });
      expect(balanceService.archiveExpiredBalances).toHaveBeenCalledTimes(1);
    });

    it('deve delegar a requisição POST para archiveBalances', async () => {
      const res = await controller.archiveBalancesPost('Bearer super-secret-cron-key-12345');
      expect(res).toEqual({ arquivados: 5, removidos: 2 });
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let eventServiceMock: Partial<EventService>;
  let balanceServiceMock: Partial<BalanceService>;
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'my-super-secret-cron-key-12345';

    eventServiceMock = {
      autoCloseExpired: vi.fn().mockResolvedValue(3),
    };

    balanceServiceMock = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 2 }),
    };

    controller = new CronController(
      eventServiceMock as EventService,
      balanceServiceMock as BalanceService,
    );
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  describe('assertAutorizado & timingSafeEqual check', () => {
    it('deve permitir acesso com Authorization Bearer válido (GET close-events)', async () => {
      const res = await controller.closeEvents('Bearer my-super-secret-cron-key-12345');
      expect(res).toEqual({ fechados: 3 });
      expect(eventServiceMock.autoCloseExpired).toHaveBeenCalledTimes(1);
    });

    it('deve permitir acesso com header x-cron-secret válido (POST close-events)', async () => {
      const res = await controller.closeEventsPost(undefined, 'my-super-secret-cron-key-12345');
      expect(res).toEqual({ fechados: 3 });
    });

    it('deve permitir acesso a archive-balances (GET e POST)', async () => {
      const resGet = await controller.archiveBalances('Bearer my-super-secret-cron-key-12345');
      expect(resGet).toEqual({ arquivados: 5, removidos: 2 });

      const resPost = await controller.archiveBalancesPost(undefined, 'my-super-secret-cron-key-12345');
      expect(resPost).toEqual({ arquivados: 5, removidos: 2 });
    });

    it('deve rejeitar se secret for incorreto (comprimento igual ou diferente)', async () => {
      await expect(
        controller.closeEvents('Bearer my-super-secret-cron-key-99999'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.closeEvents('Bearer short-secret'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.closeEvents('Bearer my-super-secret-cron-key-12345-extra-long'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve rejeitar se token não for fornecido', async () => {
      await expect(controller.closeEvents(undefined, undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve rejeitar se CRON_SECRET não estiver configurado no ambiente', async () => {
      delete process.env.CRON_SECRET;
      await expect(
        controller.closeEvents('Bearer my-super-secret-cron-key-12345'),
      ).rejects.toThrow('CRON_SECRET não configurado no servidor');
    });
  });
});

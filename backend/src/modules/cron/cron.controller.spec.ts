import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let mockEventService: Partial<EventService>;
  let mockBalanceService: Partial<BalanceService>;
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'secret123';
    mockEventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(2),
    };
    mockBalanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 3, removidos: 1 }),
    };
    controller = new CronController(
      mockEventService as EventService,
      mockBalanceService as BalanceService,
    );
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  describe('closeEvents', () => {
    it('allows access with correct Bearer authorization token', async () => {
      const res = await controller.closeEvents('Bearer secret123');
      expect(res).toEqual({ fechados: 2 });
      expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
    });

    it('allows access with correct x-cron-secret header', async () => {
      const res = await controller.closeEvents(undefined, 'secret123');
      expect(res).toEqual({ fechados: 2 });
    });

    it('throws ForbiddenException when secret is missing or incorrect', async () => {
      await expect(controller.closeEvents('Bearer wrongsecret')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.closeEvents(undefined, 'wrongsecret')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.closeEvents()).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CRON_SECRET env variable is not set', async () => {
      delete process.env.CRON_SECRET;
      await expect(controller.closeEvents('Bearer secret123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('archiveBalances', () => {
    it('allows access with correct secret and executes archiveExpiredBalances', async () => {
      const res = await controller.archiveBalances('Bearer secret123');
      expect(res).toEqual({ arquivados: 3, removidos: 1 });
      expect(mockBalanceService.archiveExpiredBalances).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when header secret is invalid', async () => {
      await expect(controller.archiveBalances('Bearer invalid')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

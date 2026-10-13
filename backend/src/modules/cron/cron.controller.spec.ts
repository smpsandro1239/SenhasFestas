import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let eventService: Partial<EventService>;
  let balanceService: Partial<BalanceService>;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    eventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(3),
    };
    balanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 2 }),
    };
    controller = new CronController(
      eventService as EventService,
      balanceService as BalanceService,
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('lança ForbiddenException se CRON_SECRET não estiver configurado', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents('Bearer my-secret')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lança ForbiddenException se nenhum secret for fornecido', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    await expect(controller.closeEvents()).rejects.toThrow(ForbiddenException);
  });

  it('lança ForbiddenException se o secret for incorreto', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    await expect(controller.closeEvents('Bearer wrong-secret')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lança ForbiddenException se o secret tiver tamanho diferente', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    await expect(controller.closeEvents('Bearer short')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('autoriza closeEvents com Authorization: Bearer <secret>', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    const result = await controller.closeEvents('Bearer super-secret-key');
    expect(result).toEqual({ fechados: 3 });
    expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('autoriza closeEvents com x-cron-secret header', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    const result = await controller.closeEvents(undefined, 'super-secret-key');
    expect(result).toEqual({ fechados: 3 });
  });

  it('autoriza archiveBalances com secret correto', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    const result = await controller.archiveBalances('Bearer super-secret-key');
    expect(result).toEqual({ arquivados: 5, removidos: 2 });
    expect(balanceService.archiveExpiredBalances).toHaveBeenCalledTimes(1);
  });

  it('executa closeEventsPost e archiveBalancesPost com sucesso', async () => {
    process.env.CRON_SECRET = 'super-secret-key';
    const resPost1 = await controller.closeEventsPost('Bearer super-secret-key');
    expect(resPost1).toEqual({ fechados: 3 });

    const resPost2 = await controller.archiveBalancesPost('Bearer super-secret-key');
    expect(resPost2).toEqual({ arquivados: 5, removidos: 2 });
  });
});

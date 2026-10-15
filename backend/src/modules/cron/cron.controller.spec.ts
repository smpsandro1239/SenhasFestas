import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

describe('CronController', () => {
  let controller: CronController;
  let eventService: Partial<EventService>;
  let balanceService: Partial<BalanceService>;

  const SECRET = 'segredo-super-secreto-123';

  beforeEach(() => {
    eventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(2),
    };
    balanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 1 }),
    };
    controller = new CronController(
      eventService as EventService,
      balanceService as BalanceService,
    );

    process.env.CRON_SECRET = SECRET;
  });

  it('permite acesso com Bearer token correto via Authorization header', async () => {
    const res = await controller.closeEvents(`Bearer ${SECRET}`);
    expect(res).toEqual({ fechados: 2 });
    expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('permite acesso com segredo correto via header x-cron-secret', async () => {
    const res = await controller.closeEvents(undefined, SECRET);
    expect(res).toEqual({ fechados: 2 });
  });

  it('permite acesso via POST manual com segredo correto', async () => {
    const res = await controller.closeEventsPost(undefined, SECRET);
    expect(res).toEqual({ fechados: 2 });
  });

  it('permite acesso ao endpoint archive-balances via GET e POST com segredo correto', async () => {
    const resGet = await controller.archiveBalances(`Bearer ${SECRET}`);
    expect(resGet).toEqual({ arquivados: 5, removidos: 1 });

    const resPost = await controller.archiveBalancesPost(undefined, SECRET);
    expect(resPost).toEqual({ arquivados: 5, removidos: 1 });
  });

  it('rejeita requisição se CRON_SECRET não estiver configurado no servidor', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents(`Bearer ${SECRET}`)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejeita se o segredo recebido for incorreto', async () => {
    await expect(controller.closeEvents('Bearer segredo-errado')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejeita se nenhum segredo for fornecido', async () => {
    await expect(controller.closeEvents(undefined, undefined)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejeita segredos de comprimentos diferentes sem erro de buffer', async () => {
    await expect(controller.closeEvents('Bearer curtinho')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

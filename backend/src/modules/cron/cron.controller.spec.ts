import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';

describe('CronController', () => {
  let controller: CronController;
  let eventService: { autoCloseExpired: ReturnType<typeof vi.fn> };
  let balanceService: { archiveExpiredBalances: ReturnType<typeof vi.fn> };
  const envOriginal = process.env.CRON_SECRET;

  beforeEach(() => {
    eventService = { autoCloseExpired: vi.fn().mockResolvedValue(2) };
    balanceService = { archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 3, removidos: 1 }) };
    controller = new CronController(eventService as any, balanceService as any);
  });

  afterEach(() => {
    process.env.CRON_SECRET = envOriginal;
  });

  it('lança ForbiddenException se CRON_SECRET não estiver configurado', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents()).rejects.toThrow(ForbiddenException);
  });

  it('lança ForbiddenException se nenhum cabeçalho for fornecido', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    await expect(controller.closeEvents()).rejects.toThrow(ForbiddenException);
  });

  it('lança ForbiddenException se o segredo tiver comprimento diferente', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    await expect(controller.closeEvents('Bearer curto')).rejects.toThrow(ForbiddenException);
  });

  it('lança ForbiddenException se o segredo for incorreto (mesmo comprimento)', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    await expect(controller.closeEvents('Bearer segredo-super-errado')).rejects.toThrow(ForbiddenException);
  });

  it('executa closeEvents com sucesso via Authorization Bearer', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    const res = await controller.closeEvents('Bearer segredo-super-seguro');
    expect(res).toEqual({ fechados: 2 });
    expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('executa closeEventsPost com sucesso via x-cron-secret', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    const res = await controller.closeEventsPost(undefined, 'segredo-super-seguro');
    expect(res).toEqual({ fechados: 2 });
    expect(eventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('executa archiveBalances e archiveBalancesPost com sucesso', async () => {
    process.env.CRON_SECRET = 'segredo-super-seguro';
    const resGet = await controller.archiveBalances('Bearer segredo-super-seguro');
    expect(resGet).toEqual({ arquivados: 3, removidos: 1 });

    const resPost = await controller.archiveBalancesPost(undefined, 'segredo-super-seguro');
    expect(resPost).toEqual({ arquivados: 3, removidos: 1 });
    expect(balanceService.archiveExpiredBalances).toHaveBeenCalledTimes(2);
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';

describe('CronController', () => {
  let controller: CronController;
  let mockEventService: any;
  let mockBalanceService: any;
  const envOriginal = process.env.CRON_SECRET;

  beforeEach(() => {
    mockEventService = {
      autoCloseExpired: vi.fn().mockResolvedValue(2),
    };
    mockBalanceService = {
      archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 5, removidos: 1 }),
    };
    controller = new CronController(mockEventService, mockBalanceService);
    process.env.CRON_SECRET = 'segredo-super-secreto-12345';
  });

  afterEach(() => {
    if (envOriginal !== undefined) {
      process.env.CRON_SECRET = envOriginal;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it('lança ForbiddenException se CRON_SECRET não estiver configurado', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.closeEvents('Bearer segredo-super-secreto-12345')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lança ForbiddenException se token for inválido (tamanho diferente ou conteúdo diferente)', async () => {
    await expect(controller.closeEvents('Bearer token-curto')).rejects.toThrow(ForbiddenException);
    await expect(
      controller.closeEvents('Bearer segredo-super-secreto-12349'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('executa closeEvents com sucesso via header Authorization Bearer', async () => {
    const res = await controller.closeEvents('Bearer segredo-super-secreto-12345');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('executa closeEvents com sucesso via header x-cron-secret', async () => {
    const res = await controller.closeEvents(undefined, 'segredo-super-secreto-12345');
    expect(res).toEqual({ fechados: 2 });
    expect(mockEventService.autoCloseExpired).toHaveBeenCalledTimes(1);
  });

  it('executa archiveBalances com sucesso quando autorizado', async () => {
    const res = await controller.archiveBalances('Bearer segredo-super-secreto-12345');
    expect(res).toEqual({ arquivados: 5, removidos: 1 });
    expect(mockBalanceService.archiveExpiredBalances).toHaveBeenCalledTimes(1);
  });
});

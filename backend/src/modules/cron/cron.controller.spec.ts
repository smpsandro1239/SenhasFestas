import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from './cron.controller';

function criarController(overrides: {
  event?: any;
  balance?: any;
  auth?: any;
} = {}) {
  const eventService = {
    autoCloseExpired: vi.fn().mockResolvedValue(3),
    ...overrides.event,
  };
  const balanceService = {
    archiveExpiredBalances: vi.fn().mockResolvedValue({ arquivados: 2, removidos: 1 }),
    ...overrides.balance,
  };
  const authService = {
    cleanupExpiredTokens: vi.fn().mockResolvedValue(7),
    ...overrides.auth,
  };
  const controller = new CronController(
    eventService as any,
    balanceService as any,
    authService as any,
  );
  return { controller, eventService, balanceService, authService };
}

const SECRET = 'segredo-de-teste';

describe('CronController — gating do CRON_SECRET (partilhado)', () => {
  const SECRET_ORIG = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (SECRET_ORIG === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = SECRET_ORIG;
  });

  it('sem CRON_SECRET configurado recusa (não expõe a rotina)', async () => {
    delete process.env.CRON_SECRET;
    const { controller } = criarController();

    await expect(controller.cleanupTokens('Bearer x')).rejects.toThrow(ForbiddenException);
  });

  it('recusa segredo errado', async () => {
    const { controller } = criarController();

    await expect(controller.cleanupTokens('Bearer errado')).rejects.toThrow(ForbiddenException);
    await expect(controller.cleanupTokens(undefined, 'errado')).rejects.toThrow(ForbiddenException);
  });

  it('recusa segredo de tamanho diferente em tempo constante sem expor side-channels', async () => {
    const { controller } = criarController();

    // Segredos mais curtos, mais longos ou com prefixos correspondentes devem ser recusados
    await expect(controller.cleanupTokens('Bearer segredo')).rejects.toThrow(ForbiddenException);
    await expect(controller.cleanupTokens(`Bearer ${SECRET}-extra`)).rejects.toThrow(ForbiddenException);
  });

  it('aceita Authorization: Bearer <secret> (formato do Vercel)', async () => {
    const { controller, authService } = criarController();

    const resultado = await controller.cleanupTokens(`Bearer ${SECRET}`);

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ removidos: 7 });
  });

  it('aceita x-cron-secret (POST manual)', async () => {
    const { controller, authService } = criarController();

    const resultado = await controller.cleanupTokensPost(undefined, SECRET);

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ removidos: 7 });
  });
});

describe('CronController — cleanup-tokens', () => {
  const SECRET_ORIG = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (SECRET_ORIG === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = SECRET_ORIG;
  });

  it('devolve a contagem de tokens removidos', async () => {
    const { controller, authService } = criarController({
      auth: { cleanupExpiredTokens: vi.fn().mockResolvedValue(322) },
    });

    const resultado = await controller.cleanupTokens(`Bearer ${SECRET}`);

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ removidos: 322 });
  });

  it('propaga a contagem zero sem falhar', async () => {
    const { controller } = criarController({
      auth: { cleanupExpiredTokens: vi.fn().mockResolvedValue(0) },
    });

    await expect(controller.cleanupTokens(`Bearer ${SECRET}`)).resolves.toEqual({ removidos: 0 });
  });

  it('não chama o serviço quando não autorizado (verifica antes de agir)', async () => {
    const { controller, authService } = criarController();

    await expect(controller.cleanupTokens('Bearer errado')).rejects.toThrow(ForbiddenException);
    expect(authService.cleanupExpiredTokens).not.toHaveBeenCalled();
  });
});

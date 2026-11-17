import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { RateLimitMiddleware, LoginRateLimitMiddleware, RequestLogMiddleware } from './audit.middleware';

function fakeReq(ip = '1.2.3.4', email?: string) {
  return { ip, body: email ? { email } : {} } as any;
}

function fakeRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((status: number) => {
    res.statusCode = status;
    return res;
  });
  res.json = vi.fn(() => res);
  res.on = vi.fn(() => res);
  return res;
}

describe('RateLimitMiddleware — fallback local quando Redis falha', () => {
  const redisService = {
    isEnabled: true,
    incrementWithTtlStrict: vi.fn(),
    incrementWithTtl: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  };

  let middleware: RateLimitMiddleware;
  const limiteOriginal = process.env.RATE_LIMIT_MAX;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RATE_LIMIT_MAX = '2';
    middleware = new RateLimitMiddleware(redisService as any);
  });

  afterEach(() => {
    if (limiteOriginal === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = limiteOriginal;
  });

  it('usa o incremento Redis estrito e atómico quando disponível', async () => {
    redisService.incrementWithTtlStrict.mockResolvedValue(2);
    const next = vi.fn();

    await middleware.use(fakeReq(), fakeRes(), next);

    expect(redisService.incrementWithTtlStrict).toHaveBeenCalled();
    expect(redisService.incrementWithTtl).not.toHaveBeenCalled();
    expect(redisService.incr).not.toHaveBeenCalled();
    expect(redisService.expire).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia acima do limite Redis', async () => {
    redisService.incrementWithTtlStrict.mockResolvedValue(3);
    const next = vi.fn();
    const res = fakeRes();

    await middleware.use(fakeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('usa contador local se Redis devolver indisponibilidade por excepção', async () => {
    redisService.incrementWithTtlStrict.mockRejectedValue(new Error('ECONNREFUSED'));
    const next = vi.fn();

    for (let i = 0; i < 2; i++) {
      await middleware.use(fakeReq(), fakeRes(), next);
    }
    // Mesmo depois de o Redis recuperar, as falhas registadas localmente
    // continuam a contar até terminar a janela.
    redisService.incrementWithTtlStrict.mockResolvedValue(1);
    const res = fakeRes();
    await middleware.use(fakeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('LoginRateLimitMiddleware — fallback local quando Redis falha', () => {
  const redisService = {
    isEnabled: true,
    incrementWithTtlStrict: vi.fn(),
    incrementWithTtl: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    getStrict: vi.fn(),
    get: vi.fn(),
  };

  let middleware: LoginRateLimitMiddleware;
  const limiteOriginal = process.env.LOGIN_RATE_LIMIT_MAX;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOGIN_RATE_LIMIT_MAX = '1';
    middleware = new LoginRateLimitMiddleware(redisService as any);
  });

  afterEach(() => {
    if (limiteOriginal === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX;
    else process.env.LOGIN_RATE_LIMIT_MAX = limiteOriginal;
  });

  it('não expõe o email em claro na chave de rate limit Redis', async () => {
    redisService.getStrict.mockResolvedValue(null);
    const middleware = new LoginRateLimitMiddleware(redisService as any);
    await middleware.use(fakeReq('1.2.3.4', 'Pessoa@Exemplo.pt'), fakeRes(), vi.fn());

    const chamadas = redisService.getStrict.mock.calls;
    const chave = chamadas[chamadas.length - 1]?.[0] as string;
    expect(chave).toMatch(/^rl:login:1\.2\.3\.4:[a-f0-9]{64}$/);
    expect(chave).not.toContain('Pessoa@Exemplo.pt');
    expect(chave).not.toContain('pessoa@exemplo.pt');
  });

  it('usa leitura estrita e incremento atómico para falhas de login', async () => {
    redisService.getStrict.mockResolvedValue(null);
    redisService.incrementWithTtlStrict.mockResolvedValue(1);
    const res = fakeRes();
    res.statusCode = 401;

    await middleware.use(fakeReq('1.2.3.4', 'a@b.com'), res, vi.fn());
    const finishCb = res.on.mock.calls.find(([event]: [string]) => event === 'finish')?.[1];
    expect(finishCb).toBeTypeOf('function');
    await finishCb();

    expect(redisService.getStrict).toHaveBeenCalled();
    expect(redisService.incrementWithTtlStrict).toHaveBeenCalled();
    expect(redisService.get).not.toHaveBeenCalled();
    expect(redisService.incrementWithTtl).not.toHaveBeenCalled();
  });

  it('conta localmente quando a leitura Redis falha e bloqueia a tentativa seguinte', async () => {
    redisService.getStrict.mockRejectedValue(new Error('ECONNREFUSED'));
    const primeira = fakeRes();
    primeira.statusCode = 401;
    const next = vi.fn();

    await middleware.use(fakeReq('1.2.3.4', 'a@b.com'), primeira, next);
    const finishCb = primeira.on.mock.calls.find(([event]: [string]) => event === 'finish')?.[1];
    await finishCb();

    redisService.getStrict.mockResolvedValue(null);
    const segunda = fakeRes();
    await middleware.use(fakeReq('1.2.3.4', 'a@b.com'), segunda, next);

    expect(segunda.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('usa contador local se Redis cair ao registar uma falha', async () => {
    redisService.getStrict.mockResolvedValue(null);
    redisService.incrementWithTtlStrict.mockRejectedValue(new Error('ECONNREFUSED'));
    const primeira = fakeRes();
    primeira.statusCode = 401;
    const next = vi.fn();

    await middleware.use(fakeReq('1.2.3.4', 'b@b.com'), primeira, next);
    const finishCb = primeira.on.mock.calls.find(([event]: [string]) => event === 'finish')?.[1];
    await finishCb();

    const segunda = fakeRes();
    await middleware.use(fakeReq('1.2.3.4', 'b@b.com'), segunda, next);

    expect(segunda.status).toHaveBeenCalledWith(429);
  });
});


describe('RequestLogMiddleware — minimização de dados', () => {
  it('regista apenas o path e nunca query strings potencialmente sensíveis', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const middleware = new RequestLogMiddleware();
    let finish: (() => void) | undefined;
    const req = {
      method: 'POST',
      path: '/auth/login',
      originalUrl: '/auth/login?email=privado@example.com&token=segredo',
    } as any;
    const res = {
      statusCode: 401,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') finish = callback;
        return res;
      }),
    } as any;

    middleware.use(req, res, vi.fn());
    finish?.();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('POST /auth/login'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('privado@example.com'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('token=segredo'));
    warn.mockRestore();
  });
});

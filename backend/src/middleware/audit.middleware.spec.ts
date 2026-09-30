import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitMiddleware, LoginRateLimitMiddleware } from './audit.middleware';

function fakeReq(ip = '1.2.3.4', email?: string) {
  return { ip, body: email ? { email } : {} } as any;
}

function fakeRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.on = vi.fn(() => res);
  return res;
}

describe('RateLimitMiddleware — A3: usa incrementWithTtl (atómico)', () => {
  const redisService = {
    isEnabled: true,
    incrementWithTtl: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  };

  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    vi.clearAllMocks();
    middleware = new RateLimitMiddleware(redisService as any);
  });

  it('usa incrementWithTtl e não incr+expire separados', async () => {
    redisService.incrementWithTtl.mockResolvedValue(2);
    const next = vi.fn();

    await middleware.use(fakeReq(), fakeRes(), next);

    expect(redisService.incrementWithTtl).toHaveBeenCalled();
    expect(redisService.incr).not.toHaveBeenCalled();
    expect(redisService.expire).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia acima do limite', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    middleware = new RateLimitMiddleware(redisService as any);
    redisService.incrementWithTtl.mockResolvedValue(5);
    const next = vi.fn();
    const res = fakeRes();

    await middleware.use(fakeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
    delete process.env.RATE_LIMIT_MAX;
  });
});

describe('LoginRateLimitMiddleware — A3: usa incrementWithTtl no registo de falha', () => {
  const redisService = {
    isEnabled: true,
    incrementWithTtl: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
  };

  let middleware: LoginRateLimitMiddleware;

  beforeEach(() => {
    vi.clearAllMocks();
    middleware = new LoginRateLimitMiddleware(redisService as any);
  });

  it('registarFalhaRedis usa incrementWithTtl e não incr+expire separados', async () => {
    redisService.get.mockResolvedValue(null);
    const res = fakeRes();
    res.statusCode = 401;

    await middleware.use(fakeReq('1.2.3.4', 'a@b.com'), res, vi.fn());
    // registarFalhaRedis é chamado no finish; disparar o callback registado
    const finishCb = res.on.mock.calls.find(([e]: [string]) => e === 'finish')?.[1];
    expect(finishCb).toBeTypeOf('function');
    await finishCb();

    expect(redisService.incrementWithTtl).toHaveBeenCalled();
    expect(redisService.incr).not.toHaveBeenCalled();
    expect(redisService.expire).not.toHaveBeenCalled();
  });
});
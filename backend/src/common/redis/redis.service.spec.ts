import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisService } from './redis.service';

describe('RedisService — incrementWithTtl (A3: INCR+EXPIRE atómico)', () => {
  const client = {
    incr: vi.fn(),
    expire: vi.fn(),
    eval: vi.fn(),
    get: vi.fn(),
  };

  let service: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RedisService(client as any);
  });

  it('usa eval (Lua) em vez de incr+expire separados', async () => {
    client.eval.mockResolvedValue(3);

    const result = await service.incrementWithTtl('rl:ip:x', 60);

    expect(result).toBe(3);
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining('INCR'), 1, 'rl:ip:x', 60);
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining('EXPIRE'), 1, 'rl:ip:x', 60);
    expect(client.incr).not.toHaveBeenCalled();
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('não expira chaves pré-existentes (só quando v === 1)', async () => {
    client.eval.mockResolvedValue(1);

    await service.incrementWithTtl('k', 30);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("if v == 1 then"),
      1,
      'k',
      30,
    );
  });

  it('liberta reservas com DECR e apaga atomicamente o contador quando chega a zero', async () => {
    client.eval.mockResolvedValue(0);

    const result = await service.releaseCounterReservationStrict('rl:login:x');

    expect(result).toBe(0);
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('DECR'"),
      1,
      'rl:login:x',
    );
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('DEL'"),
      1,
      'rl:login:x',
    );
  });

  it('o release estrito propaga indisponibilidade Redis', async () => {
    const disabled = new RedisService(null);

    await expect(disabled.releaseCounterReservationStrict('rl:login:x'))
      .rejects.toThrow('Redis não configurado');
  });

  it('devolve null quando o cliente está indisponível no método tolerante', async () => {
    const disabled = new RedisService(null);

    await expect(disabled.incrementWithTtl('k', 60)).resolves.toBeNull();
  });

  it('o incremento estrito propaga indisponibilidade em vez de devolver null', async () => {
    const disabled = new RedisService(null);

    await expect(disabled.incrementWithTtlStrict('k', 60)).rejects.toThrow('Redis não configurado');
  });

  it('a leitura estrita distingue chave ausente de falha Redis', async () => {
    client.get.mockResolvedValue(null);
    await expect(service.getStrict('rl:login:x')).resolves.toBeNull();

    client.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.getStrict('rl:login:x')).rejects.toThrow('ECONNREFUSED');
  });
});
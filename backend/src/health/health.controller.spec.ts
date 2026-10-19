import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from '../common/redis/redis.service';

function criarController(opcoes: { bdOk?: boolean; redisStatus?: string | null } = {}) {
  const dataSource = {
    query: opcoes.bdOk === false
      ? vi.fn().mockRejectedValue(new Error('ligação recusada'))
      : vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  const redisClient =
    opcoes.redisStatus === null || opcoes.redisStatus === undefined
      ? null
      : ({ status: opcoes.redisStatus } as unknown as Redis);
  const controller = new HealthController(
    { get: vi.fn().mockReturnValue('test') } as unknown as ConfigService,
    dataSource as unknown as DataSource,
    redisClient,
  );
  return { controller, dataSource };
}

function respostaFalsa() {
  return { status: vi.fn().mockReturnThis() };
}

describe('HealthController.ready', () => {
  it('devolve 200 quando a base de dados responde e o Redis está desativado', async () => {
    const { controller, dataSource } = criarController({ redisStatus: null });
    const res = respostaFalsa();

    const corpo = await controller.ready(res as never);

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(res.status).not.toHaveBeenCalled();
    expect(corpo.status).toBe('ready');
    expect(corpo.dependencies).toEqual({ database: 'healthy', redis: 'disabled' });
  });

  it('devolve 200 quando o Redis está configurado e pronto', async () => {
    const { controller } = criarController({ redisStatus: 'ready' });
    const res = respostaFalsa();

    const corpo = await controller.ready(res as never);

    expect(res.status).not.toHaveBeenCalled();
    expect(corpo.status).toBe('ready');
    expect(corpo.dependencies.redis).toBe('healthy');
  });

  it('devolve 503 quando o Redis está configurado mas não pronto', async () => {
    const { controller } = criarController({ redisStatus: 'connecting' });
    const res = respostaFalsa();

    const corpo = await controller.ready(res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(corpo.status).toBe('unhealthy');
    expect(corpo.dependencies).toEqual({ database: 'healthy', redis: 'unhealthy' });
  });

  it('devolve 503 quando a base de dados falha, mesmo com Redis pronto', async () => {
    const { controller } = criarController({ bdOk: false, redisStatus: 'ready' });
    const res = respostaFalsa();

    const corpo = await controller.ready(res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(corpo.status).toBe('unhealthy');
    expect(corpo.dependencies).toEqual({ database: 'unhealthy', redis: 'healthy' });
  });

  it('inclui timestamp ISO no corpo', async () => {
    const { controller } = criarController({ redisStatus: 'ready' });
    const corpo = await controller.ready(respostaFalsa() as never);
    expect(new Date(corpo.timestamp).toISOString()).toBe(corpo.timestamp);
  });
});

describe('HealthController.live', () => {
  it('devolve alive sem tocar em dependências', () => {
    const { controller, dataSource } = criarController();
    const corpo = controller.live();
    expect(corpo.status).toBe('alive');
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

describe('HealthController.check', () => {
  it('devolve ok com o ambiente configurado', () => {
    const { controller } = criarController();
    const corpo = controller.check();
    expect(corpo.status).toBe('ok');
    expect(corpo.environment).toBe('test');
    expect(corpo.version).toBe('1.0.0');
  });
});

describe('REDIS_CLIENT', () => {
  it('exporta o token de injecção usado pelo módulo', () => {
    expect(REDIS_CLIENT).toBe('REDIS_CLIENT');
  });
});

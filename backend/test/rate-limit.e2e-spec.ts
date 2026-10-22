import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAplicacao } from '../src/app.setup';

const LIMITE = 3;
const RAIZ = '/api/health/live';

/**
 * O rate limit conta por IP numa janela de 60s e o limite é lido do ambiente
 * na construção do middleware. Com o limite do CI (1000) nenhum teste o pode
 * provar — e o orçamento é partilhado com os restantes pedidos do runner.
 * Aqui o limite é posto a 3 antes de a aplicação ser criada.
 *
 * O Redis é desligado de propósito (`REDIS_URL` vazio): o contador do Redis
 * é partilhado por todas as instâncias (mesmo IP) e o TTL de 60s sobrevive
 * ao ficheiro de teste. Sem Redis, o middleware conta em memória, por
 * instância — o teste passa a ser determinista. O caminho com Redis está
 * coberto em `src/middleware/audit.middleware.spec.ts`.
 */
describe('Rate limit e2e (429, não 500)', () => {
  let app: INestApplication;
  let limiteOriginal: string | undefined;
  let redisOriginal: string | undefined;

  beforeAll(async () => {
    limiteOriginal = process.env.RATE_LIMIT_MAX;
    redisOriginal = process.env.REDIS_URL;
    process.env.RATE_LIMIT_MAX = String(LIMITE);
    process.env.REDIS_URL = '';

    try {
      app = await criarAplicacao({ swagger: false });
      await app.init();
    } catch (error) {
      throw new Error(
        `e2e de rate limit requer Postgres local acessível. Rejeitado no pré-voo: ${(error as Error).message}. ` +
          'Corre `docker compose up -d postgres redis` na raiz do repositório (com POSTGRES_PASSWORD definido no .env raiz) e tenta de novo.',
      );
    }
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (limiteOriginal === undefined) {
      delete process.env.RATE_LIMIT_MAX;
    } else {
      process.env.RATE_LIMIT_MAX = limiteOriginal;
    }
    if (redisOriginal === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = redisOriginal;
    }
  }, 30000);

  it('deve recusar com 429 a partir do limite, sem nunca devolver 5xx', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMITE + 3; i++) {
      statuses.push((await request(app.getHttpServer()).get(RAIZ)).status);
    }

    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // Nenhum pedido passa do limite: a janela conta por IP.
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(LIMITE);
  });

  it('o 429 devolve statusCode 429 e mensagem (não 500)', async () => {
    for (let i = 0; i < LIMITE + 1; i++) {
      await request(app.getHttpServer()).get(RAIZ);
    }

    const response = await request(app.getHttpServer()).get(RAIZ).expect(429);
    expect(response.body.statusCode).toBe(429);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });
});

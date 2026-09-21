import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { criarAplicacao } from '../src/app.setup';
import { UserEntity } from '../src/entities';
import { AuthService } from '../src/modules/auth/auth.service';

const PROBE_TIMEOUT_MS = 5000;

async function verificarBaseDadosDisponivel(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const client = new Client({
    connectionString: url || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'senhasfestas',
    ssl: url ? { rejectUnauthorized: false } : undefined,
  });
  await Promise.race([
    client.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout após ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
    ),
  ]);
  await client.end();
}

describe('App e2e (Postgres + Redis)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    try {
      await verificarBaseDadosDisponivel();
    } catch (error) {
      throw new Error(
        `e2e requer Postgres local acessível. Rejeitado no pré-voo: ${(error as Error).message}. ` +
          'Corre `docker compose up -d postgres redis` na raiz do repositório (com POSTGRES_PASSWORD definido no .env raiz) e tenta de novo.',
      );
    }

    app = await criarAplicacao({ swagger: false });
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.runMigrations();
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  async function criarUtilizadorTeste(email: string): Promise<{ email: string; password: string }> {
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(UserEntity);
    const password = 'password123';
    await userRepo.save(
      userRepo.create({
        email,
        password: await bcrypt.hash(password, 10),
        name: 'Teste E2E',
        role: 'client',
        accessCode: '123456',
        isActive: true,
      }),
    );
    return { email, password };
  }

  async function refreshTokenDe(email: string, password: string): Promise<string> {
    const authService = app.get(AuthService);
    const { refreshToken } = await authService.login(email, password);
    return refreshToken;
  }

  it('deve responder na rota de liveness', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(response.body.status).toBe('alive');
  });

  it('deve reportar a base de dados saudável', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);
    expect(response.body.dependencies.database).toBe('healthy');
  });

  it('deve recusar rate limit com 429 (não 500)', async () => {
    const max = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
    const totalRequests = Math.min(12, max + 2);
    const statuses: number[] = [];
    for (let i = 0; i < totalRequests; i++) {
      statuses.push((await request(app.getHttpServer()).get('/api/health/live')).status);
    }
    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true);
    if (max < totalRequests) {
      expect(statuses).toContain(429);
    }
  });

  it('refresh aceita cookie httpOnly sem body (contrato de sessão do frontend)', async () => {
    const { email, password } = await criarUtilizadorTeste('refresh-cookie@example.com');
    const refreshToken = await refreshTokenDe(email, password);

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `sf_refresh=${refreshToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(response.body.token).toBeDefined();
    expect(response.body.refreshToken).toBeUndefined();
    const setCookie = response.headers['set-cookie'] as string[];
    expect(setCookie.join(';')).toContain('HttpOnly');
    expect(setCookie.join(';')).not.toContain('Domain=');
  });

  it('logout sem body limpa a sessão (200) e revoga o refresh token', async () => {
    const { email, password } = await criarUtilizadorTeste('logout-cookie@example.com');
    const refreshToken = await refreshTokenDe(email, password);

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `sf_refresh=${refreshToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(response.headers['set-cookie']).toBeDefined();

    const reutilizado = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `sf_refresh=${refreshToken}`)
      .set('Content-Type', 'application/json')
      .expect(401);
    expect(reutilizado.body.statusCode).toBe(401);
  });

  it('refresh sem cookie nem body devolve 401 (token em falta), não 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Content-Type', 'application/json')
      .expect(401);
  });
});
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { criarAplicacao } from '../src/app.setup';
import { UserEntity, ProductEntity, OrderEntity, OrderItemEntity } from '../src/entities';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { configuracaoBaseDadosE2e } from './e2e-database-safety';

const PROBE_TIMEOUT_MS = 5000;

/**
 * `IDX_users_access_code` é único e o helper insere vários utilizadores no
 * mesmo ficheiro — um código fixo rebentava no segundo insert. Contador por
 * ficheiro (6 dígitos, dentro do formato que a app gera): os utilizadores de
 * teste são criados só aqui, pela camada de repositório, sem passar pela API
 * que gera códigos.
 */
let contadorAccessCode = 100000;

function proximoAccessCode(): string {
  contadorAccessCode += 1;
  return String(contadorAccessCode);
}

async function verificarBaseDadosDisponivel(): Promise<void> {
  const client = new Client(configuracaoBaseDadosE2e());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`timeout após ${PROBE_TIMEOUT_MS}ms`)),
          PROBE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    await client.end().catch(() => undefined);
  }
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
        accessCode: proximoAccessCode(),
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
    const response = await request(app.getHttpServer()).get('/api/health/ready');
    expect(response.body.dependencies.database).toBe('healthy');
  });

  it('ready devolve 503 se alguma dependência estiver unhealthy (200 caso contrário)', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready');
    const deps = response.body.dependencies as Record<string, string>;
    const indisponivel = Object.values(deps).includes('unhealthy');

    expect(response.status).toBe(indisponivel ? 503 : 200);
    expect(response.body.status).toBe(indisponivel ? 'unhealthy' : 'ready');
  });

  it('refresh aceita cookie httpOnly sem body (contrato de sessão do frontend)', async () => {
    const { email, password } = await criarUtilizadorTeste('refresh-cookie@example.com');
    const refreshToken = await refreshTokenDe(email, password);

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `sf_refresh=${refreshToken}`)
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3001')
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
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3001')
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(response.headers['set-cookie']).toBeDefined();

    const reutilizado = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `sf_refresh=${refreshToken}`)
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3001')
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
  it('sugestões por coocorrência só contam artigos de pedidos com o produto alvo', async () => {
    const dataSource = app.get(DataSource);
    const products = dataSource.getRepository(ProductEntity);
    const orders = dataSource.getRepository(OrderEntity);
    const orderItems = dataSource.getRepository(OrderItemEntity);
    const catalog = app.get(CatalogService);

    const alvo = await products.save(
      products.create({ name: 'E2E Produto Alvo', price: 1, isActive: true }),
    );
    const candidatoA = await products.save(
      products.create({ name: 'E2E Candidato A', price: 2, isActive: true }),
    );
    const candidatoB = await products.save(
      products.create({ name: 'E2E Candidato B', price: 3, isActive: true }),
    );
    const inativo = await products.save(
      products.create({ name: 'E2E Produto Inativo', price: 4, isActive: false }),
    );

    const criarPedido = (status: OrderEntity['status']) =>
      orders.save(orders.create({ source: 'qr', status, total: 10 }));
    const adicionarArtigo = (
      order: OrderEntity,
      product: ProductEntity,
      quantity: number,
    ) =>
      orderItems.save(
        orderItems.create({
          order,
          product,
          quantity,
          unitPrice: Number(product.price),
          subtotal: Number(product.price) * quantity,
        }),
      );

    const pedido1 = await criarPedido('delivered');
    await adicionarArtigo(pedido1, alvo, 1);
    await adicionarArtigo(pedido1, candidatoA, 2);

    const pedido2 = await criarPedido('received');
    await adicionarArtigo(pedido2, alvo, 1);
    await adicionarArtigo(pedido2, candidatoA, 1);
    await adicionarArtigo(pedido2, candidatoB, 1);
    await adicionarArtigo(pedido2, inativo, 1);

    // Um pedido sem o produto alvo não pode influenciar a classificação.
    const pedidoSemAlvo = await criarPedido('delivered');
    await adicionarArtigo(pedidoSemAlvo, candidatoB, 99);

    // Pedidos cancelados também não entram nas sugestões.
    const pedidoCancelado = await criarPedido('cancelled');
    await adicionarArtigo(pedidoCancelado, alvo, 1);
    await adicionarArtigo(pedidoCancelado, candidatoB, 50);

    const resultado = await catalog.findSuggestions(
      { id: 'e2e-catalog', role: 'client' } as any,
      undefined,
      alvo.id,
      4,
    );

    expect(resultado.source).toBe('cooccurrence');
    expect(resultado.items.map((produto) => produto.id)).toEqual([
      candidatoA.id,
      candidatoB.id,
    ]);
  });

});
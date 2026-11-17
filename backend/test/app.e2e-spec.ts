import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { criarAplicacao } from '../src/app.setup';
import { UserEntity, ProductEntity, OrderEntity, OrderItemEntity, EventEntity, EventUserEntity, BalanceEntity, BalanceMovementEntity, MovementType } from '../src/entities';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { OrderService } from '../src/modules/order/order.service';
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

  async function criarCaixaComEvento(sufixo: string): Promise<{
    user: UserEntity;
    event: EventEntity;
    token: string;
  }> {
    const dataSource = app.get(DataSource);
    const password = 'password123';
    const email = `cashier-${sufixo}-${randomUUID()}@example.com`;
    const userRepository = dataSource.getRepository(UserEntity);
    const user = await userRepository.save(
      userRepository.create({
        email,
        password: await bcrypt.hash(password, 10),
        name: 'Caixa E2E',
        role: 'cashier',
        accessCode: proximoAccessCode(),
        isActive: true,
      }),
    );
    const eventRepository = dataSource.getRepository(EventEntity);
    const event = await eventRepository.save(
      eventRepository.create({
        name: `E2E Saldo ${sufixo}`,
        shortCode: `BAL-${randomUUID().slice(0, 8)}`,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      }),
    );
    await dataSource.getRepository(EventUserEntity).save(
      dataSource.getRepository(EventUserEntity).create({
        event,
        user,
        role: 'cashier',
      }),
    );
    const { token } = await app.get(AuthService).login(email, password);
    return { user, event, token };
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
  it('cria uma única encomenda e baixa stock uma vez em retries concorrentes', async () => {
    const dataSource = app.get(DataSource);
    const { email } = await criarUtilizadorTeste('order-idempotency@example.com');
    const user = await dataSource.getRepository(UserEntity).findOneByOrFail({ email });
    const eventRepository = dataSource.getRepository(EventEntity);
    const eventUsers = dataSource.getRepository(EventUserEntity);
    const products = dataSource.getRepository(ProductEntity);
    const orders = dataSource.getRepository(OrderEntity);
    const orderService = app.get(OrderService);

    const event = await eventRepository.save(
      eventRepository.create({
        name: 'E2E Idempotência',
        shortCode: `IDEM-${randomUUID().slice(0, 8)}`,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      }),
    );
    await eventUsers.save(
      eventUsers.create({ event, user, role: 'organizer' }),
    );
    const product = await products.save(
      products.create({
        event,
        name: 'E2E Produto com stock',
        price: 2.5,
        stock: 2,
        isActive: true,
      }),
    );

    const idempotencyKey = randomUUID();
    const payload = {
      eventId: event.id,
      source: 'pos',
      paymentMethod: 'cash',
      items: [{ productId: product.id, quantity: 2 }],
    };

    const [first, second] = await Promise.all([
      orderService.create(user, payload as any, idempotencyKey),
      orderService.create(user, payload as any, idempotencyKey),
    ]);

    expect(first.id).toBe(second.id);
    expect(
      await orders.count({
        where: {
          event: { id: event.id },
          createdById: user.id,
          idempotencyKey,
        },
      }),
    ).toBe(1);

    const afterConcurrentRetry = await products.findOneByOrFail({ id: product.id });
    expect(Number(afterConcurrentRetry.stock)).toBe(0);

    const replay = await orderService.create(user, payload as any, idempotencyKey);
    expect(replay.id).toBe(first.id);
    const afterReplay = await products.findOneByOrFail({ id: product.id });
    expect(Number(afterReplay.stock)).toBe(0);

    await expect(
      orderService.create(
        user,
        { ...payload, items: [{ productId: product.id, quantity: 3 }] } as any,
        idempotencyKey,
      ),
    ).rejects.toThrow('Idempotency-Key já utilizada com outro conteúdo');
  });

  it('bloqueia produtos por ID em ordem estável quando encomendas concorrentes invertem os artigos', async () => {
    const dataSource = app.get(DataSource);
    const { email } = await criarUtilizadorTeste('order-stock-lock-order@example.com');
    const user = await dataSource.getRepository(UserEntity).findOneByOrFail({ email });
    const eventRepository = dataSource.getRepository(EventEntity);
    const eventUsers = dataSource.getRepository(EventUserEntity);
    const products = dataSource.getRepository(ProductEntity);
    const orders = dataSource.getRepository(OrderEntity);
    const orderService = app.get(OrderService);

    const event = await eventRepository.save(
      eventRepository.create({
        name: 'E2E Ordem de locks',
        shortCode: `LOCK-${randomUUID().slice(0, 8)}`,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      }),
    );
    await eventUsers.save(eventUsers.create({ event, user, role: 'organizer' }));
    const [produtoA, produtoB] = await products.save([
      products.create({ event, name: 'E2E Lock A', price: 1, stock: 2, isActive: true }),
      products.create({ event, name: 'E2E Lock B', price: 1, stock: 2, isActive: true }),
    ]);

    const payload = (items: Array<{ productId: string; quantity: number }>) => ({
      eventId: event.id,
      source: 'pos',
      paymentMethod: 'cash',
      items,
    });
    const [pedidoAB, pedidoBA] = await Promise.all([
      orderService.create(
        user,
        payload([
          { productId: produtoA.id, quantity: 1 },
          { productId: produtoB.id, quantity: 1 },
        ]) as any,
        randomUUID(),
      ),
      orderService.create(
        user,
        payload([
          { productId: produtoB.id, quantity: 1 },
          { productId: produtoA.id, quantity: 1 },
        ]) as any,
        randomUUID(),
      ),
    ]);

    expect(pedidoAB.id).not.toBe(pedidoBA.id);
    expect(
      await orders.count({ where: { event: { id: event.id }, createdById: user.id } }),
    ).toBe(2);
    const [stockA, stockB] = await Promise.all([
      products.findOneByOrFail({ id: produtoA.id }),
      products.findOneByOrFail({ id: produtoB.id }),
    ]);
    expect(Number(stockA.stock)).toBe(0);
    expect(Number(stockB.stock)).toBe(0);
  });

  it('não duplica carregamentos concorrentes com a mesma Idempotency-Key', async () => {
    const dataSource = app.get(DataSource);
    const caixa = await criarCaixaComEvento('load');
    const { email } = await criarUtilizadorTeste(`balance-load-${randomUUID()}@example.com`);
    const cliente = await dataSource.getRepository(UserEntity).findOneByOrFail({ email });
    const key = randomUUID();
    const endpoint = `/api/balances/${cliente.id}/load`;
    const payload = { eventId: caixa.event.id, amount: 25, paymentMethod: 'cash' };

    const enviar = (body = payload) =>
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', `Bearer ${caixa.token}`)
        .set('Idempotency-Key', key)
        .send(body);

    const [first, second] = await Promise.all([enviar(), enviar()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const saldo = await dataSource.getRepository(BalanceEntity).findOne({
      where: { user: { id: cliente.id }, event: { id: caixa.event.id } },
    });
    expect(saldo).not.toBeNull();
    expect(Number(saldo!.currentBalance)).toBe(25);
    expect(
      await dataSource.getRepository(BalanceMovementEntity).count({
        where: {
          createdById: caixa.user.id,
          idempotencyKey: key,
          type: MovementType.LOAD,
        },
      }),
    ).toBe(1);

    const conflito = await enviar({ ...payload, amount: 30 });
    expect(conflito.status).toBe(409);
    const saldoDepoisDoConflito = await dataSource.getRepository(BalanceEntity).findOneByOrFail({
      id: saldo!.id,
    });
    expect(Number(saldoDepoisDoConflito.currentBalance)).toBe(25);
  });

  it('não duplica descontos concorrentes nem volta a debitar saldo em retries', async () => {
    const dataSource = app.get(DataSource);
    const caixa = await criarCaixaComEvento('deduct');
    const { email } = await criarUtilizadorTeste(`balance-deduct-${randomUUID()}@example.com`);
    const cliente = await dataSource.getRepository(UserEntity).findOneByOrFail({ email });
    const endpoint = `/api/balances/${cliente.id}`;
    const chaveCarga = randomUUID();
    const chaveDesconto = randomUUID();

    await request(app.getHttpServer())
      .post(`${endpoint}/load`)
      .set('Authorization', `Bearer ${caixa.token}`)
      .set('Idempotency-Key', chaveCarga)
      .send({ eventId: caixa.event.id, amount: 50, paymentMethod: 'cash' })
      .expect(201);

    const enviarDesconto = () =>
      request(app.getHttpServer())
        .post(`${endpoint}/deduct`)
        .set('Authorization', `Bearer ${caixa.token}`)
        .set('Idempotency-Key', chaveDesconto)
        .send({ eventId: caixa.event.id, amount: 10, description: 'Consumo E2E' });

    const [first, second] = await Promise.all([enviarDesconto(), enviarDesconto()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const saldo = await dataSource.getRepository(BalanceEntity).findOneByOrFail({
      user: { id: cliente.id },
      event: { id: caixa.event.id },
    });
    expect(Number(saldo.currentBalance)).toBe(40);
    expect(
      await dataSource.getRepository(BalanceMovementEntity).count({
        where: {
          createdById: caixa.user.id,
          idempotencyKey: chaveCarga,
          type: MovementType.LOAD,
        },
      }),
    ).toBe(1);
    expect(
      await dataSource.getRepository(BalanceMovementEntity).count({
        where: {
          createdById: caixa.user.id,
          idempotencyKey: chaveDesconto,
          type: MovementType.CONSUME,
        },
      }),
    ).toBe(1);
  });

  it('não duplica estornos parciais concorrentes quando o cliente repete o pedido', async () => {
    const dataSource = app.get(DataSource);
    const caixa = await criarCaixaComEvento('reverse');
    const { email } = await criarUtilizadorTeste(`balance-reverse-${randomUUID()}@example.com`);
    const cliente = await dataSource.getRepository(UserEntity).findOneByOrFail({ email });
    const endpoint = `/api/balances/${cliente.id}`;
    const chaveCarga = randomUUID();
    const chaveEstorno = randomUUID();

    await request(app.getHttpServer())
      .post(`${endpoint}/load`)
      .set('Authorization', `Bearer ${caixa.token}`)
      .set('Idempotency-Key', chaveCarga)
      .send({ eventId: caixa.event.id, amount: 25, paymentMethod: 'cash' })
      .expect(201);

    const carregamento = await dataSource.getRepository(BalanceMovementEntity).findOneByOrFail({
      createdById: caixa.user.id,
      idempotencyKey: chaveCarga,
      type: MovementType.LOAD,
    });

    const enviarEstorno = (amount: number) =>
      request(app.getHttpServer())
        .post(`${endpoint}/reverse/${carregamento.id}?eventId=${caixa.event.id}`)
        .set('Authorization', `Bearer ${caixa.token}`)
        .set('Idempotency-Key', chaveEstorno)
        .send({ amount });

    const [first, second] = await Promise.all([
      enviarEstorno(10),
      enviarEstorno(10),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const saldos = dataSource.getRepository(BalanceEntity);
    const saldo = await saldos.findOneByOrFail({
      user: { id: cliente.id },
      event: { id: caixa.event.id },
    });
    expect(Number(saldo.currentBalance)).toBe(15);
    expect(
      await dataSource.getRepository(BalanceMovementEntity).count({
        where: {
          reversedOfId: carregamento.id,
          createdById: caixa.user.id,
          type: MovementType.CANCEL,
        },
      }),
    ).toBe(1);

    const conflito = await enviarEstorno(15);
    expect(conflito.status).toBe(409);
    const replay = await enviarEstorno(10);
    expect(replay.status).toBe(201);

    const saldoFinal = await saldos.findOneByOrFail({ id: saldo.id });
    expect(Number(saldoFinal.currentBalance)).toBe(15);
    expect(
      await dataSource.getRepository(BalanceMovementEntity).count({
        where: {
          reversedOfId: carregamento.id,
          createdById: caixa.user.id,
          type: MovementType.CANCEL,
        },
      }),
    ).toBe(1);
  });

});

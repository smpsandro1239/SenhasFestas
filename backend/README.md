# SenhasFestas — Backend

NestJS 12 + TypeORM + PostgreSQL + Redis + WebSocket (Socket.IO).

## Requisitos

- Node.js ≥ 20
- PostgreSQL 15+ (ou o fornecido pelo `docker compose` na raiz)
- Redis 7 (opcional)

## Setup

```bash
npm install
cp .env.example .env   # preencher com os dados locais
```

Para subir apenas a base de dados e o Redis:

```bash
docker compose up -d postgres redis   # a partir da raiz do repositório
```

## Executar

```bash
npm run start:dev      # desenvolvimento (watch)
npm run build          # compilar para dist/
npm run start:prod     # node dist/main
```

A API fica em `http://localhost:3000/api` (prefixo global `/api`) e o Swagger em
`http://localhost:3000/api/docs`.

## Migrações

Em desenvolvimento o TypeORM usa `synchronize`; em produção (`NODE_ENV=production`)
aplica as migrações automáticas no arranque (`migrationsRun`).

```bash
npm run migration:run        # aplicar
npm run migration:revert     # reverter última
npm run migration:generate   # gerar nova a partir das entidades (precisa de BD)
```

## Testes, lint e build

```bash
npm run lint   # oxlint
npm test       # vitest (unitários)
npm run build  # nest build
```

## Estrutura

```
src/
  common/          # guards (AuthGuard/RolesGuard), decorators, filtros
  database/        # data-source + migrações
  entities/        # entidades TypeORM (13 tabelas)
  modules/         # auth, user, event, catalog, balance, order, kitchen, ...
  middleware/      # Security, RateLimit, Audit
  services/        # qr-code, notification
  websocket/       # OrderGateway (estados em tempo real + Redis pub/sub)
  seeds/           # seeds de desenvolvimento
```

## Segurança

- `POST /auth/register` cria apenas clientes (`role: client`).
- Contas staff são criadas por admin (`POST /users` com `@Roles('superadmin','organizer')`).
- RBAC via `@Roles(...)` + `RolesGuard`.
- Rate limiting global (100 req/min por IP, configurável com `RATE_LIMIT_MAX`).

## Redis

O `RedisModule` é opcional (`@Global`). Sem `REDIS_URL` o sistema continua a funcionar
sem cache/pub-sub:
- `order:status:<id>` (TTL 24h) — cache do estado do pedido
- canal `order:updates` — publish de atualizações em tempo real
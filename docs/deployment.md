# Guia de Deploy — SenhasFestas

## Visão geral

- **Frontend:** Next.js 14 (Vercel ou Docker). PWA instalável.
- **Backend:** NestJS 12 (VPS/CloudRun/qualquer plataforma com Docker ou Node).
- **Base de dados:** PostgreSQL 15+ (a migração usa `gen_random_uuid()`, nativo do PG 13+).
- **Cache/Pub-Sub:** Redis 7 (opcional — sem `REDIS_URL` o backend degrada com graça).

> O backend expõe todas as rotas com o prefixo `/api` e aplica `npm run migration:run`
> automático no arranque quando `NODE_ENV=production`.

## 1. Variáveis de ambiente

### Backend (`backend/.env`)

```dotenv
PORT=3000
NODE_ENV=production
DB_HOST=<host>
DB_PORT=5432
DB_USERNAME=<user>
DB_PASSWORD=<pass>
DB_NAME=senhasfestas
JWT_SECRET=<segredo-forte-de-64-caracteres>
FRONTEND_URL=https://<dominio-frontend>
REDIS_URL=redis://<redis-host>:6379
RATE_LIMIT_MAX=100
```

- `REDIS_URL` é opcional; sem Redis, cache e pub/sub ficam desativados.
- `RATE_LIMIT_MAX` controla o limite por IP/minuto (100 por omissão).

### Frontend (`frontend/.env.production`)

```dotenv
NEXT_PUBLIC_API_URL=https://<api-url>   # base do backend SEM o sufixo /api
NEXT_PUBLIC_WS_URL=wss://<api-url>
```

> O frontend já anexa `/api` automaticamente. Não duplique o sufixo.

## 2. Base de dados

No servidor de PostgreSQL:

```sql
CREATE DATABASE senhasfestas;
```

As tabelas/índices são criados pela migração inicial. Em produção o backend corre com
`synchronize=false` e `migrationsRun=true` (aplica migrações pendentes no arranque).

Para aplicar manualmente:

```bash
cd backend
npm run migration:run
```

### Seed (desenvolvimento)

Com `NODE_ENV=development`, o backend insere utilizadores de teste:
`admin@senhasfestas.com / admin123` (superadmin) e `organizer@senhasfestas.com / organizer123`,
etc. **Não usar em produção.**

## 3. Backend (Docker)

```bash
cd backend
docker build -t senhasfestas-backend .
docker run -d --name senhasfestas-backend \
  -p 3000:3000 \
  --env-file .env \
  senhasfestas-backend
```

Ou via `docker compose` na raiz (sobe Postgres + Redis + backend + frontend:

```bash
docker compose up -d --build
```

## 4. Frontend (Vercel)

1. Importar o repositório na Vercel.
2. Diretório raiz: `frontend`; comando build: `npm run build`; output: padrão (Next.js).
3. Variáveis de ambiente: `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL`.
4. Os `rewrites` do `next.config.js` encaminham `/api/*` para o backend.

> A Vercel aloja apenas o frontend; backend, PostgreSQL e Redis correm fora
> (VPS, CloudRun, etc.) — use o domínio da API em `NEXT_PUBLIC_API_URL`.

## 5. RBAC

- `POST /auth/register` cria sempre utilizadores com role `client`.
- Contas de staff (`organizer`, `cashier`, `bar`, `kitchen`, `treasurer`, `superadmin`)
  são criadas pelo admin em `POST /users` (requer `superadmin`/`organizer`).
- Endpoints de escrita de catálogo/eventos exigem `superadmin`/`organizer`.

## 6. Verificação pós-deploy

- `GET /api/health` → deve responder 200.
- Swagger: `https://<api>/api/docs`.
- Testar login de um utilizador e criação de pedido.

## 7. Troubleshooting

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| 401 em `/api/users` | Token inválido/desatualizado | Refazer login |
| 403 | Role insuficiente | Pedir `superadmin`/`organizer` |
| `function gen_random_uuid() does not exist` | PostgreSQL < 13 | Atualizar para PG 13+ |
| CORS 403 no browser | `FRONTEND_URL` errado | Apontar para o domínio do frontend |
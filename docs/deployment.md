# Guia de Deploy — SenhasFestas

## Visão geral

- **Frontend:** Next.js (export `standalone`) — Docker ou VPS. PWA instalável.
- **Backend:** NestJS — Docker, VPS ou qualquer plataforma com Node/Docker.
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
LOGIN_RATE_LIMIT_MAX=10
TRUST_PROXY=1
```

- `REDIS_URL` é opcional; sem Redis, cache e pub/sub ficam desativados (modo degradado).
- `RATE_LIMIT_MAX` controla o limite por IP/minuto (100 por omissão).
- `TRUST_PROXY` é o número de proxies de confiança à frente do backend (1 em produção
  atrás de um proxy/reverse que termina TLS). Sem ele, o redirect HTTPS e o rate limit
  por IP deixam de funcionar corretamente.

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

## 3. Duas possibilidades de execução

O projeto pode correr **com Docker** ou **sem Docker** (nativo). As duas partilham a
mesma base de código e o mesmo ficheiro `.env`.

### 3.1 Com Docker — stack completa em containers

Sobe Postgres + Redis + backend + frontend tudo em containers:

```bash
npm run docker:up          # docker compose up -d --build
```

| App        | URL                          |
| ---        | ---                          |
| Frontend   | http://localhost:3001        |
| API        | http://localhost:3000/api    |
| Swagger    | http://localhost:3000/api/docs |

- Parar: `npm run docker:down` — Logs: `npm run docker:logs`.
- O `frontend/Dockerfile` recebe `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` como
  **build args** (o Next.js congela estas variáveis no build; passá-las apenas em
  runtime não tem efeito). Em Docker, aponte para `http://backend:3000` (rede do compose).
- O middleware do frontend partilha o `JWT_SECRET` com o backend (variável de runtime
  `JWT_SECRET` no container do frontend) para validar as sessões.
- Credenciais da BD e segredos podem ser sobrescritos num `.env` na raiz (ver
  `.env.example` na raiz). `POSTGRES_PASSWORD` e `JWT_SECRET` são obrigatórios.

### 3.2 Sem Docker — infra nativa + apps locais (híbrido)

Apps correm no host; apenas Postgres e Redis sobem em containers:

```bash
npm run docker:infra        # docker compose up -d postgres redis
# numa segunda janela:
npm run dev                 # backend :3000 + frontend :3001
```

### 3.3 Sem Docker em lado nenhum (nativo total)

Postgres e Redis instalados localmente (sem qualquer Docker):

```bash
cp .env.example .env        # na raiz, para o compose (opcional)
cp backend/.env.example backend/.env
npm run dev
```

Ajuste `backend/.env` com o host/porta das suas instâncias locais
(`DB_HOST`, `DB_PORT`, `REDIS_URL`) e corra a migração/dependências:

```bash
cd backend && npm install && npm run migration:run
```

## 4. Backend (Docker) — imagem isolada

```bash
cd backend
docker build -t senhasfestas-backend .
docker run -d --name senhasfestas-backend \
  -p 3000:3000 \
  --env-file .env \
  senhasfestas-backend
```

## 5. Frontend (Docker) — imagem isolada

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://<api-url> \
  --build-arg NEXT_PUBLIC_WS_URL=wss://<api-url> \
  -t senhasfestas-frontend .
docker run -d --name senhasfestas-frontend \
  -p 3001:3000 \
  -e JWT_SECRET=<segredo> \
  senhasfestas-frontend
```

> O frontend pode ser alojado em VPS com Nginx/Caddy, em qualquer PaaS com Docker,
> ou num serviço de frontend estático (para este caso é preciso exportar a app sem
> os `rewrites` do proxy — ver `next export`). Use o domínio da API em
> `NEXT_PUBLIC_API_URL`.

## 6. RBAC

- `POST /auth/register` cria sempre utilizadores com role `client`.
- Contas de staff (`organizer`, `cashier`, `bar`, `kitchen`, `treasurer`, `superadmin`)
  são criadas pelo admin em `POST /users` (requer `superadmin`/`organizer`).
- Endpoints de escrita de catálogo/eventos exigem `superadmin`/`organizer`.

## 7. Verificação pós-deploy

- `GET /api/health` → deve responder 200.
- Swagger: `https://<api>/api/docs`.
- Testar login de um utilizador e criação de pedido.

## 8. Troubleshooting

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| 401 em `/api/users` | Token inválido/desatualizado | Refazer login |
| 403 | Role insuficiente | Pedir `superadmin`/`organizer` |
| `function gen_random_uuid() does not exist` | PostgreSQL < 13 | Atualizar para PG 13+ |
| CORS 403 no browser | `FRONTEND_URL` errado | Apontar para o domínio do frontend |
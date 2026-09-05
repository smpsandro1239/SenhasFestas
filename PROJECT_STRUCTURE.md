# SenhasFestas — Estrutura do projeto

## Backend (NestJS + TypeORM + Socket.IO)
```
backend/
├── src/
│   ├── app.module.ts            # Módulo raiz (autoLoadEntities, synchronize: false)
│   ├── main.ts                  # Bootstrap, global prefix /api, seeders
│   ├── entities/index.ts        # Todas as entidades
│   ├── modules/
│   │   ├── auth/                # Login, refresh tokens, JWT strategy, rate limit
│   │   ├── user/
│   │   ├── event/
│   │   ├── catalog/             # Categorias e produtos (paginado)
│   │   ├── balance/
│   │   ├── order/               # Orders + items (paginado; locks pessimistas)
│   │   ├── kitchen/             # KDS com WebSocket (rooms por evento)
│   │   ├── public-screen/       # Balcão público via WebSocket
│   │   ├── reports/
│   │   ├── cash-closure/
│   │   └── public/
│   ├── common/                  # DTOs de paginação (PaginationQueryDto), etc.
│   ├── guards/                  # AuthGuard, RolesGuard
│   ├── decorators/
│   ├── services/                # QR-code, WebSocket gateway, notificações
│   └── utils/
├── database/
│   ├── data-source.ts           # Configuração TypeORM (data-source)
│   └── migrations/              # Migrações (ex.: 1789000000000-HardeningIndexes.ts)
├── test/                        # Testes e2e (auth, app)
├── .env.example
├── Dockerfile
├── vitest.config.ts             # Testes unitários
└── vitest.config.e2e.ts         # Testes e2e
```

## Frontend (Next.js 14 App Router + Tailwind)
```
frontend/
├── src/
│   ├── middleware.ts            # Guard server-side (auth e roles por cookies)
│   ├── layout/sidebar.tsx       # Sidebar responsiva (roles por evento)
│   ├── components/
│   │   └── ui/                  # tabs, card, spinner, icons, etc. (ARIA)
│   ├── app/
│   │   ├── auth/login/          # Página pública de login
│   │   ├── auth/register/
│   │   ├── admin/               # Gestão de eventos e utilizadores
│   │   ├── caixa/               # Abertura/fecho de caixa, saldo
│   │   ├── cozinha/             # KDS (WebSocket)
│   │   ├── pedidos/             # Lista de pedidos
│   │   ├── perfil/
│   │   ├── publico/             # Balcão público
│   │   ├── qr-order/            # Pedido por QR code
│   │   ├── relatorios/
│   │   ├── saldo/
│   │   └── layout.tsx           # Providers (Auth, SW register, metadata)
│   └── lib/
│       ├── api.ts               # Cliente HTTP com refresh tokens e cookies de sessão
│       ├── auth-context.tsx     # Sessão (persistSession/destroySession)
│       ├── use-current-event.ts # Evento ativo selecionado
│       └── cn.ts
├── public/
│   ├── sw.js                    # Service worker (precache estável, network-first)
│   ├── manifest.webmanifest
│   └── icon-*.png
├── next.config.js               # standalone, security headers, remotePatterns por env
├── .eslintrc.json
├── .env.example
└── Dockerfile
```

## Infraestrutura e deploy
```
├── .github/workflows/ci.yml     # CI: lint/build/testes; e2e com Postgres+Redis; deploy ssh
├── docker-compose.yml           # postgres, redis, backend, frontend (JWT obrigatório)
├── scripts/deploy.sh            # Deploy local: testes → build → migrações (aborta em falha)
├── .env.example                 # Variáveis raiz (JWT_SECRET obrigatório)
└── PROJECT_STRUCTURE.md
```

## Base de dados (PostgreSQL)
Tabelas principais:
1. `users` — utilizadores do sistema
2. `events` — eventos/festas
3. `event_users` — relações evento/role por utilizador
4. `categories` — categorias do menu
5. `products` — produtos do menu
6. `balances` — saldos por utilizador/evento
7. `balance_movements` — histórico de movimentos de saldo
8. `orders` — pedidos (QR e balcão)
9. `order_items` — itens dos pedidos
10. `stations` — bares/caixas
11. `cash_closures` — fechos de caixa
12. `refresh_tokens` — tokens de renovação (hash, família, revogação)
13. `audit_logs` — trilho de auditoria

Migrações: `cd backend && npm run migration:run` (aborta o deploy em caso de falha).

## Fluxo de autenticação
- Login/refresh devolvem `{ token, refreshToken, user }`.
- O frontend persiste a sessão (localStorage) e faz rotação do refresh token num 401.
- `middleware.ts` valida cookies (`sf_token`, `sf_role`, `sf_user`) para proteger `/admin`, `/relatorios` e `/caixa`.

## Testes
- Unitários: `cd backend && npm test` (Vitest, 15 specs).
- E2E: `cd backend && npm run test:e2e` (requer Postgres/Redis; em CI via `services`).
- Frontend: `cd frontend && npm run lint && npm run build`.
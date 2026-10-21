# TODO — SenhasFestas

> Índice de trabalho vivo. As descrições, roadmap e dívida técnica vivem no
> `PLAN.md`; o log das sessões vive no `PROGRESS.md`. Este ficheiro é só o
> **estado/prioridade/dependências** do trabalho em curso.

Legenda de estado: `[ ]` pendente · `[~]` em curso · `[x]` concluído · `[!]` bloqueado

| Estado | Item | Área | Prioridade | Depende de | Notas / prova |
|---|---|---|---|---|---|
| `[x]` | #11 multi-planta | planta | alta | — | commits `19b0349`…`4b2ee92`; E2E Playwright 9/9; vitest FE 278/278 |
| `[x]` | #12-backend `plantaUpdated` + fallback Redis | realtime | alta | — | commits `ec1c2eb` + `2d6df0d`; E2E socket.io com Redis parado |
| `[x]` | T1 contrato `tipo` + room `event:<id>:planta` restrita a `MANAGEMENT_ROLES` | realtime | alta | — | commit `13d0ca4`; boot `:3011` com DI resolvida; vitest 482/482 |
| `[x]` | T2 spec do `OrderGateway` (20 testes: fallback Redis, wiring ready/end, join restrito) | realtime | alta | T1 | commit `6896af2` |
| `[x]` | T4b auditoria de segredos (`.env` tracked, `.gitignore`, CI) | segurança | alta | — | só `.env.example` tracked; `.env` gitignored; `ci.yml` cobre lint/test/build/e2e/migrações |
| `[x]` | T4 limpar heading duplicado `PROGRESS.md` + `TODO.md` + limitação serverless no `PLAN.md` | docs | média | — | `uniq -d` vazio; `-5` linhas; nota WS serverless em `PLAN.md` |
| `[x]` | T3 frontend #12: `use-planta-socket`, helper `decidirAdocaoRemota`, aviso/eco/refetch-lista | realtime | alta | T1 | commit `9e10b37`; vitest FE 295/295; E2E UI dois contextos verde (adopção 2.9s + aviso sem perder edição) |
| `[x]` | T6 diagnóstico login dev (cookie `sf_token`) | bugfix | alta | — | NÃO é bug: era timing do teste + dev server sem hidratar (`__webpack_modules__`); limpar `.next` resolve |
| `[x]` | T7 E2E UI dois contextos | testes | alta | T6 | evento `e2e-*` criado/apagado; `festa-teste-2026` intacto |
| `[x]` | T8 spec `use-planta-socket` | testes | média | — | commit `41077d8`; 8 testes jsdom |
| `[x]` | T9 corrigir nota serverless do `PLAN.md` | docs | média | — | commit `0451ded`; causa real = runtime serverless sem WS |
| `[x]` | Suite browser Playwright do realtime da planta (dois contextos) | testes | alta | T7 | `frontend/e2e/planta-realtime.spec.ts`; 1 passed 46.5s local; evento `e2e-*` criado/apagado |
| `[x]` | Ligar a suite browser Playwright ao CI | ci | média | — | job `browser-e2e` (Postgres+Redis+Chromium); validado local `2 passed`; deploy passa a depender dele |
| `[x]` | #14 indicador de realtime no canal de planta | realtime | média | — | commit `feat(frontend)`; `usePlantaSocket` devolve `status`; badge no admin; motor partilhado com `useOrderSocket`; vitest FE 297/297 |
| `[x]` | Cron limpeza de tokens em serverless | ops | alta | — | `/api/cron/cleanup-tokens` (GET/POST, `CRON_SECRET`) + `vercel.json` `0 3 * * *`; vitest BE 489/489; boot `:3011` 403 |
| `[!]` | B teste de integração Redis do `OrderGateway` | realtime | média | Redis acessível | sem docker/redis-server nesta máquina — não verificável; job `browser-e2e` do CI já tem `redis:8-alpine` |
| `[!]` | T5 push de `main` | release | alta | autorização explícita | 24 commits locais à frente de `origin/main`; nunca encadear com commit |
| `[!]` | #5 validação visual com `cdt` | — | média | restart do opencode | tools `cdt_*` não carregadas na sessão |
| `[x]` | #13 bump `chrome-devtools-mcp` (pinado `@1.11.0`) | — | baixa | — | verificado 2026-10-20: `latest` também é `1.11.0` — pin já actual; nada a fazer |

## Bloqueadores

- **T5** — push só com autorização explícita do utilizador (regra do `AGENTS.md`).
- **#5** — o `chrome-devtools-mcp` só expõe as tools após reinício do opencode.

## Recados de dívida (registados no `PLAN.md`)

- WebSocket não funciona em serverless (`backend/src/serverless.main.ts` reutiliza
  `criarAplicacao`/`AppModule`, logo o gateway **é instanciado**; falha o runtime, não
  o registo).
- Redis obrigatório no `.env` mas não a correr → gateway cai em emissão local (por desenho).

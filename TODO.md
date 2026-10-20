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
| `[x]` | T3 frontend #12: `use-planta-socket`, helper `decidirAdocaoRemota`, aviso/eco/refetch-lista | realtime | alta | T1 | commit `9e10b37`; vitest FE 287/287 (+9); E2E socket dois clientes ok |
| `[!]` | T5 push de `main` | release | alta | autorização explícita | 11 commits locais à frente de `origin/main`; nunca encadear com commit |
| `[!]` | #5 validação visual com `cdt` | — | média | restart do opencode | tools `cdt_*` não carregadas na sessão |
| `[ ]` | #13 bump `chrome-devtools-mcp` (pinado `@1.11.0`) | — | baixa | — | `PLAN.md` |

## Bloqueadores

- **T5** — push só com autorização explícita do utilizador (regra do `AGENTS.md`).
- **#5** — o `chrome-devtools-mcp` só expõe as tools após reinício do opencode.

## Recados de dívida (registados no `PLAN.md`)

- WebSocket não funciona em serverless (`backend/src/serverless.main.ts` sem `OrderGateway`).
- Redis obrigatório no `.env` mas não a correr → gateway cai em emissão local (por desenho).

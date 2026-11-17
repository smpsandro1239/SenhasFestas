# TODO — SenhasFestas

> Índice de trabalho vivo. As descrições, roadmap e dívida técnica vivem no
> `PLAN.md`; o log das sessões vive no `PROGRESS.md`. Este ficheiro é só o
> **estado/prioridade/dependências** do trabalho em curso.

Legenda de estado: `[ ]` pendente · `[~]` em curso · `[x]` concluído · `[!]` bloqueado

Identificadores: `T<n>` = tarefa desta lista · `R<n>` = item do roadmap do
`PLAN.md` · `D<n>` = dívida técnica do `PLAN.md`. (O `D13` e o `R13` não são o
mesmo item — daí o prefixo.)

| Estado | Item | Área | Prioridade | Depende de | Notas / prova |
|---|---|---|---|---|---|
| `[x]` | T40 redacção de segredos nos logs de auditoria (`before`/`after`/`details`) | segurança/auditoria | alta | — | PR #163 integrada; JWT/Bearer corrigido. CI backend, frontend, Browser E2E, docs, Security e CodeQL passou na validação da PR #164; deploy Vercel continua limitado por quota diária |
| `[x]` | T41 serializar arquivo automático de saldos com lock por linha e revalidação transaccional | financeiro/concorrência | alta | — | PR #166 integrada (`2e62722`); CI backend unit/build/Postgres E2E, frontend, Browser E2E, docs, Security e CodeQL passou; Vercel bloqueada por quota diária |
| `[x]` | #11 multi-planta | planta | alta | — | commits `19b0349`…`4b2ee92`; E2E Playwright 9/9; vitest FE 278/278 |
| `[x]` | #12-backend `plantaUpdated` + fallback Redis | realtime | alta | — | commits `ec1c2eb` + `2d6df0d`; E2E socket.io com Redis parado |
| `[x]` | T1 contrato `tipo` + room `event:<id>:planta` restrita a `MANAGEMENT_ROLES` | realtime | alta | — | commit `13d0ca4`; boot `:3011` com DI resolvida; vitest 482/482 |
| `[x]` | T2 spec do `OrderGateway` (20 testes: fallback Redis, wiring ready/end, join restrito) | realtime | alta | T1 | commit `6896af2` |
| `[x]` | T4b auditoria de segredos (`.env` tracked, `.gitignore`, CI) | segurança | alta | — | só `.env.example` tracked; `.env` gitignored; `ci.yml` cobre lint/test/build/e2e/migrações |
| `[x]` | T4 limpar heading duplicado `PROGRESS.md` + `TODO.md` + limitação serverless no `PLAN.md` | docs | média | — | `uniq -d` vazio; `-5` linhas; nota WS serverless em `PLAN.md` |
| `[x]` | T3 frontend #12: `use-planta-socket`, helper `decidirAdocaoRemota`, aviso/eco/refetch-lista | realtime | alta | T1 | commit `9e10b37`; vitest FE 295/295; E2E UI dois contextos verde (adopção 2.9s + aviso sem perder edição) |
| `[x]` | T6 diagnóstico login dev (cookie `sf_token`) | bugfix | alta | — | NÃO é bug: era timing do teste + dev server sem hidratar (`__webpack_modules__`); limpar `.next` resolve. **Prova DOM**: `PROGRESS.md` 2026-10-20 — login real `POST /api/auth/login` 200, cookies `sf_token`/`sf_refresh` presentes (httpOnly, SameSite=Lax), `localStorage.user` gravado, `/admin` persiste após reload. O contrato de sessão está coberto por `frontend/e2e/session.spec.ts` (6 testes DOM). *Residual*: o script de diagnóstico foi ad-hoc e não foi commitado |
| `[x]` | T7 E2E UI dois contextos | testes | alta | T6 | **Prova DOM**: `PROGRESS.md` 2026-10-20 — mesa de A aparece no DOM de B sem reload (2878 ms) e banner "mudou noutro dispositivo" com a edição local de B intacta. **Spec commitada**: `frontend/e2e/planta-realtime.spec.ts` (login pela UI, `.planta-mesa` visível, aviso visível) — corre no job `browser-e2e` do CI. Evento `e2e-*` criado/apagado; `festa-teste-2026` intacto |
| `[x]` | T8 spec `use-planta-socket` | testes | média | — | commit `41077d8`; 8 testes jsdom do hook `use-planta-socket` — **concluído** (a pendência de *build Docker* é da `T11`, não desta) |
| `[x]` | T9 corrigir nota serverless do `PLAN.md` | docs | média | — | commit `0451ded`; causa real = runtime serverless sem WS |
| `[x]` | Suite browser Playwright do realtime da planta (dois contextos) | testes | alta | T7 | `frontend/e2e/planta-realtime.spec.ts`; 1 passed 46.5s local; evento `e2e-*` criado/apagado |
| `[x]` | Ligar a suite browser Playwright ao CI | ci | média | — | job `browser-e2e` (Postgres+Redis+Chromium); validado local `2 passed`; deploy passa a depender dele |
| `[x]` | #14 indicador de realtime no canal de planta | realtime | média | — | commit `feat(frontend)`; `usePlantaSocket` devolve `status`; badge no admin; motor partilhado com `useOrderSocket`; vitest FE 297/297 |
| `[x]` | Cron limpeza de tokens em serverless | ops | alta | — | `/api/cron/cleanup-tokens` (GET/POST, `CRON_SECRET`) + `vercel.json` `0 3 * * *`; vitest BE 489/489; boot `:3011` 403 |
| `[!]` | B teste de integração Redis do `OrderGateway` | realtime | média | Redis acessível | sem docker/redis-server nesta máquina — não verificável; job `browser-e2e` do CI já tem `redis:8-alpine` |
| `[x]` | T5 push de `main` | release | alta | autorização explícita | **push feito** (autorização explícita em 2026-10-21): **34 commits** (`4dc6b56..fedc1fb`, contagem exacta por `git rev-list --count`, confirmada por `git log --oneline`), série do `#13` completa — `259ed29`…`fedc1fb` |
| `[!]` | #5 validação visual com `cdt` | — | média | restart do opencode | tools `cdt_*` não carregadas na sessão |
| `[x]` | R13 bump `chrome-devtools-mcp` (pinado `@1.11.0`) | — | baixa | — | verificado 2026-10-20: `latest` também é `1.11.0` — pin já actual; nada a fazer |
| `[x]` | D13 pacote `@senhasfestas/shared` (dívida técnica do `TipoAlteracaoPlanta` duplicado) | infra | alta | — | commits `259ed29`…`4565805`; contrato de realtime com uma só definição; TypeScript unificado (uma cópia, 5.7.3) |
| `[x]` | T11 corrigir os dois Dockerfiles para o layout do monorepo | infra | alta | D13 | **prova local OK**: o runtime do backend copia `packages/shared/dist`; o runner do frontend usa `frontend/server.js`; layout replicado e arrancado localmente. **Build Docker a verificar** (sem Docker no ambiente) |
| `[x]` | T12 remover o lockfile stale de `backend/` + alinhar dependências | infra | alta | D13 | `backend/package-lock.json` removido do índice; `@senhasfestas/shared` a `"*"`; `npm ci --dry-run` verde |
| `[x]` | T13 verificar os 3 callers de `useOrderSocket` (cozinha/pedidos/pos) | testes | alta | R14 | a API pública não mudou (`useOrderSocket(refetch, eventId)`); `onOrderUpdated` não existe em lado nenhum; o `+10` testes era do #14 (`use-planta-socket.test.tsx`) |
| `[x]` | T15 docs de #13 (PLAN/PROGRESS/TODO) + limpeza de portas e temporários | docs | média | D13 | runner standalone validado em `:3002` e terminado; `/tmp` limpo |
| `[x]` | T16 validação automática dos documentos (chaves únicas) | docs | média | — | `npm run verify:docs` + job `docs` no CI; falha com a linha duplicada exacta |
| `[x]` | T17 reescrever a série do #13 para manifestos e lock em sintonia | infra | média | D13 | commits `259ed29`…`4565805`; `npm ci --dry-run` a 0 em cada commit; série antiga em `backup/pre-t17` |
| `[x]` | T18 configuração do projecto Vercel (root directory, build command) | ops | média | — | **verificado pelo deploy de `fedc1fb`**: os dois deployments (`senhas-festas` e `senhasfestas-api`) acabaram `success`; `https://senhas-festas-ten.vercel.app/auth/login` → 200 (HTML esperado, `<title>SenhasFestas - Gestão de Pedidos para Festas</title>`), `/admin` → 307 → `/auth/login?from=%2Fadmin` (correcto sem sessão); `https://senhasfestas-api.vercel.app/api/health` → 200 `{"status":"ok",...}`; crons → 403 sem o segredo; CSP/HSTS/`X-Frame-Options` presentes. *Residual*: os campos raw do dashboard (`rootDirectory`, `buildCommand`) não são legíveis sem token válido (`T34`) — o alias de produção é `senhas-festas-ten.vercel.app` (`senhas-festas.vercel.app` dá 404) |
| `[x]` | T19 `nest g` depois do `overrides` do TypeScript | infra | baixa | — | **mantido**: `nest g resource tmpProbe --dry-run` exit 0; sem o `overrides` a árvore resolvida é idêntica — a violação do peer `>= 6.0.0` é do `@nestjs/schematics@12`, não do `overrides` |
| `[x]` | T26 verificar a primeira execução real do CI (GitHub Actions) | ci | alta | — | run `39658459926` (sha `fedc1fb`, 88 s): `Frontend` ✅ (lint + typecheck + build), `Documentação` ✅, `Backend` ❌ nos e2e, `Browser E2E` ❌ nas migrações, `Deploy` ⏭ `skipped` — a produção **não** foi tocada por este push |
| `[x]` | T31 `migration:run` no CI: `Cannot find module 'ts-node'` | ci | alta | D16 | **resolvido** (commits `f62d71b` + `e790d65`): o `ts-node` passa a `devDependencies` da raiz (`~10.9.2`) → hoisted para `node_modules/ts-node` e o `require('ts-node')` do CLI do TypeORM resolve (`require.resolve` → `node_modules/ts-node/dist/index.js`; o diff do lock são só 2 entradas novas). Apurado no caminho: o glob `migrations: ['*.ts']` (desde `679f83d`) apanhava também o `index.spec.ts` da pasta e o import de `vitest` rebentava em CommonJS — bug **pré-existente** ao `#13` (`0f3b330`), mascarado pela morte do CLI. `migration:run` local → exit 0 ("No migrations are pending") |
| `[x]` | T32 e2e do backend com 429 (`RATE_LIMIT_MAX: 5`) | testes | alta | — | **resolvido** (commits `aae5cae` + `bdce67a`): a causa era o teste de 429 dentro de `app.e2e-spec.ts` consumir o orçamento por IP (5) que os testes de sessão partilhavam. `RATE_LIMIT_MAX` do job `backend` → 1000 (igual ao `browser-e2e`) e o 429 passou para um spec próprio (`backend/test/rate-limit.e2e-spec.ts`) com limite 3 e Redis desligado (contagem em memória, determinista) — **passa localmente (2/2)**. A config e2e ficou com `fileParallelism: false`: os ficheiros e2e partilham a BD e um deles faz `DROP SCHEMA public CASCADE` |
| `[x]` | T33 `access_code` fixo no helper de teste e2e | testes | média | — | **resolvido** (commit `7d82b38`): `criarUtilizadorTeste` usa agora um contador por ficheiro (`100001`, `100002`, ...), 6 dígitos dentro do formato que a app gera, sem aleatoriedade. O `'123456'` que ficou no repositório só vive em mocks/fixtures unitárias (`access-code.spec.ts`, `roles.guard.spec.ts`, `short-code.spec.ts`, `user.service.spec.ts` — repositório mockado) e na lista de senhas fracas do bootstrap — nenhum chega à BD |
| `[ ]` | T34 token da CLI Vercel inválido | ops | baixa | — | o token em `%APPDATA%/com.vercel.cli/Data/auth.json` devolve `invalidToken` (403) → a API do Vercel não é consultável (nem para ler a config do dashboard, nem para gerir deployments/aliases). Re-login (`vercel login`) é preciso para usar a CLI |
| `[ ]` | T35 apagar a tag `archive/pre-t17` | ops | baixa | — | por decisão do utilizador: a tag (que guarda a série antiga do `#13`, `ca133e8`) apaga-se 7 dias depois de criada — **a partir de 2026-10-29** |
| `[x]` | T36 o rate limit **falha aberto** quando o Redis está configurado mas inacessível | segurança | alta | D17 | Operações Redis estritas e fallback local nos dois middlewares; testes de indisponibilidade/recuperação passaram no CI backend (PR #167). Limitação: fallback por processo, não global entre réplicas |
| `[x]` | T37 o pré-voo do e2e não garante que a base de dados é local | segurança | alta | D18 | Helper exige opt-in, host loopback e sufixo `_test`/`_e2e`; carrega `.env.development`/`.env` com precedência NestJS e respeita SSL. Testes de segurança E2E e PostgreSQL passaram no CI (PR #167) |
| `[x]` | T38 o Service Worker podia guardar HTML/RSC autenticado e a UI prometia sincronização offline inexistente | pwa/segurança | alta | D19 | Cache v5 só mantém assets estáticos; navegações/RSC privados não são persistidos; página offline descreve limitações. Regressão PWA passou no workflow Security e frontend Vitest no CI (PR #167). Fila offline transaccional continua por implementar e não deve ser anunciada como disponível |
| `[x]` | Integrar suite Vitest do frontend no GitHub Actions | ci/testes | média | — | Job frontend executa `npm test` depois de lint/typecheck e antes do build; Vitest, typecheck e build passaram no CI (PR #167) |

| `[x]` | T39 governação de segurança do repositório: política de divulgação, Dependabot, CodeQL e permissões CI | segurança/ci/docs | média | D20 | Política `SECURITY.md`, Dependabot semanal, CodeQL e permissões mínimas integrados; Gitleaks, auditoria de dependências e CodeQL passaram no CI (PR #167). A primeira execução automática do Dependabot continua dependente do agendamento semanal |

Nota (Vercel de 2026-10-21): o push `fedc1fb` disparou os dois deployments da
integração Vercel (frontend e API) e ambos acabaram `success` — a produção está
com o código novo **antes** de o `deploy` do CI (que é o backend no VPS) correr.
A verificação seguiu o checklist de `docs/vercel-deploy.md`: `/auth/login` → 200,
`/api/health` → 200, `/admin` → 307 para o login, crons → 403 sem o segredo.

Nota (CI real de 2026-10-21, run `39658459926`): o primeiro push da série do `#13`
correu o CI a sério. `Frontend` e `Documentação` passaram; `Backend` e `Browser E2E`
falharam e o `Deploy` ficou `skipped` — **a produção não foi tocada por este push**.
As causas estão em `T31` (regressão do `#13`: o `ts-node`), `T32` (429 nos e2e) e
`T33` (`access_code` duplicado no teste). Nada foi corrigido "no calor": cada
correcção é tarefa própria.

Nota (correcção de 2026-10-21): o resumo da revisão dizia "T18/T8" — era **T18/T11**.
O item bloqueado por falta de *build Docker* é a `T11` (Dockerfiles); o `T8` (spec do
`use-planta-socket`) está concluído desde `41077d8` e não tem pendência nenhuma.

Nota (revisão de 2026-10-21): `T6`/`T7` **mantêm-se concluídos** — a revisão
afirmava "marcados como `[x]` sem prova no DOM", mas a prova DOM existe e estava
registada no `PROGRESS.md` (2026-10-20) e, no caso de `T7`, numa spec commitada que
o CI corre. O que faltava era a *âncora* da prova na nota do item — foi aí que se
corrigiu. `T6` fica com um residual anotado (o script de diagnóstico foi ad-hoc e
não foi commitado).

## Bloqueadores

- **T5** — o push só happens com autorização explícita do utilizador (regra do
  `AGENTS.md`). O lote do `#13` foi autorizado e pushed; os próximos continuam a
  depender de autorização.
- **#5** — o `chrome-devtools-mcp` só expõe as tools após reinício do opencode.

## Recados de dívida (registados no `PLAN.md`)

- WebSocket não funciona em serverless (`backend/src/serverless.main.ts` reutiliza
  `criarAplicacao`/`AppModule`, logo o gateway **é instanciado**; falha o runtime, não
  o registo).
- Redis obrigatório no `.env` mas não a correr → gateway cai em emissão local (por desenho).
- `outputFileTracingRoot` mudou o layout do standalone: o entrypoint é
  `frontend/server.js` e o `public`/`.next/static` vivem em `frontend/`. Qualquer cópia
  em CI, Docker ou Vercel tem de respeitar isto.
- `joinEventPlanta` aparece nos bundles de `cozinha`/`pedidos`/`pos` porque
  `MENSAGENS_ENTRADA` é um objecto partilhado (~15 bytes por bundle). Aceitável; se
  incomodar, importar só as chaves individuais.
- **Build Docker ainda por verificar** (não há Docker no ambiente): o layout do runner
  e do runtime foi replicado e arrancado localmente, mas o `docker build` em si não
  correu.

---

# Backlog consolidado de produto, engenharia e operação (2026-11-17)

Esta secção é a **fonte de verdade para o trabalho ainda por resolver**. Os itens
históricos acima mantêm-se como registo; os itens abaixo são o plano executável
a seguir. Não marcar uma tarefa como concluída apenas por existir código: exige
critérios de aceitação, testes adequados e evidência registada no
`PROGRESS.md`. Quando uma auditoria confirmar que um risco não existe, fechar o
item com a prova e não implementar alterações desnecessárias.

Legenda: `[ ]` por iniciar · `[~]` em curso · `[x]` concluído · `[!]` bloqueado.
Prioridades: **P0** bloqueia segurança/produção; **P1** essencial antes de beta/
produção; **P2** melhoria importante; **P3** evolução futura.

## Ordem de execução

1. **Segurança e integridade** — T42 a T46.
2. **Dados, desempenho e resiliência** — T47 a T52.
3. **Qualidade funcional e experiência** — T53 a T58.
4. **Entrega, operação e documentação** — T59 a T62.

## Backlog activo

| Estado | ID | Trabalho a resolver / melhorar / acrescentar | Prioridade | Critério de conclusão |
|---|---|---|---|---|
| [~] | T42 | Rate limiting distribuído e política de falha Redis em produção | P0 | Limites de login/API coerentes entre réplicas; comportamento explícito quando Redis falha; sem bypass por reinício/instância; testes concorrentes e de indisponibilidade; health checks não bloqueados. Login e API geral exigem Redis em produção e falham com 503/Retry-After; health checks são excluídos do limiter e readiness exige Redis. Testes de fail-closed, bypass e não reutilização do contador local foram acrescentados. A CI completa passou nos commits 08fa452 e 674651b (backend lint/testes/build/PostgreSQL E2E, frontend lint/build, Browser E2E, documentação e CodeQL). O job Deploy produção terminou success, mas os passos de migração e SSH foram skipped; não há deploy confirmado. Falta observabilidade e verificação de configuração Redis em ambiente real. |
| [~] | T43 | Auditoria integral das operações financeiras e administrativas | P0 | Rever carregamentos, consumos, estornos, transferências, extensões, fechos de caixa, stock, permissões e alterações de evento; confirmar snapshots before/after, actor, eventId, entidade, motivo, correlação e sanitização; testes que provem ausência de segredos e de duplicados. Cancelamentos de pedidos registam dados financeiros; operações de saldo identificam o BalanceEntity correcto, montantes, movimentos, ambos os lados das transferências e replays idempotentes. O interceptor passou a derivar entityId/eventId de respostas de criação (eventos, pedidos e utilizadores), classificar importações/duplicações/membros e emitir registos separados por evento e saldo nas transferências entre eventos; testes adicionados. A CI do commit 674651b passou com os testes do interceptor e BalanceService incluídos. Falta rever cobertura dos restantes domínios e garantir fiabilidade/outbox da persistência. |
| [~] | T44 | Auditoria de autorização e isolamento multi-evento (tenant isolation) | P0 | RolesGuard valida event-roles em endpoints agregados e memberships em operações multi-evento; pedidos, saldos, catálogo e lookup directo de produto respeitam o evento. Room WebSocket de pedidos só aceita STAFF_ROLES. CI do commit `d655b4c` passou em backend, frontend, Browser E2E, documentação e deploy. Corrigido `params.eventoId` em caixa. Revogação de membership agora expulsa sockets locais das rooms de pedidos/planta e propaga via Redis após alterações/removals pela administração, com testes adicionados. O fluxo `auth/enter-event?replace=true` passou a devolver internamente os IDs substituídos ao controller, que revoga rooms locais/Redis sem expor esses IDs na API; testes unitários adicionados. Falta concluir revisão de IDs directos/serviços e operações longas. |
| [ ] | T45 | Integridade financeira, idempotência e concorrência ponta-a-ponta | P0 | Rever criação/cancelamento de pedidos, descontos, estornos, transferências, fecho de caixa e reposição de stock; transacções, locks, constraints e chaves idempotentes; testes PostgreSQL concorrentes e invariantes contabilísticas (sem saldo/stock negativo indevido nem movimentos duplicados). |
| [ ] | T46 | Revisão de autenticação, sessões, cookies e protecção contra abuso | P1 | Rever access/refresh, rotação/revogação, logout, expiração, recuperação de conta, brute force, códigos de acesso, CSRF/CORS e headers; testes de regressão e documentação das decisões. |
| [ ] | T47 | Auditoria de esquema PostgreSQL, índices e migrations | P1 | Inventário de entidades/índices/FK/unique/check constraints; detectar índices em falta ou redundantes, colunas sem uso, migrations não reversíveis e divergências entre schema e entidades; propor migrations pequenas e testadas com BD vazia e upgrade real. |
| [ ] | T48 | Perfil de performance das queries e eliminação de N+1 | P1 | Medir endpoints críticos com dados representativos; usar EXPLAIN (ANALYZE, BUFFERS) em ambiente de teste; rever paginação/ordenação/filtros e relações TypeORM; estabelecer baseline e justificar cada índice. |
| [ ] | T49 | Paginação, filtros e limites de payload em todas as listagens | P1 | Inventariar endpoints de listagem; impor paginação estável, limites máximos, ordenação determinística e validação de filtros; testes para grandes volumes e prevenção de respostas sem limite. |
| [ ] | T50 | Escalabilidade do realtime e compatibilidade de deployment | P1 | Documentar e testar Socket.IO com Redis adapter/fan-out em múltiplas réplicas; esclarecer comportamento na Vercel/serverless; garantir fallback/aviso explícito e definir arquitectura suportada para produção. |
| [ ] | T51 | Backups, restauro e recuperação de desastre PostgreSQL/Redis | P1 | Definir RPO/RTO, política de backup, retenção, encriptação e acesso; executar restauro numa instância isolada; validar migrations e integridade após restauro; documentar runbook. |
| [ ] | T52 | Observabilidade operacional e alertas | P1 | Logs estruturados com correlation/request ID, métricas de latência/erros/filas/Redis/BD, alertas accionáveis e dashboards; garantir redacção de dados pessoais/segredos; documentar health/readiness e resposta a incidentes. |
| [ ] | T53 | Testes E2E completos dos fluxos POS, cliente QR, cozinha/KDS e ecrã público | P1 | Cobrir percurso completo por role e evento: criar pedido, validar saldo/stock, preparar, entregar, cancelar/estornar; cenários de falha, concorrência e reconexão; dados E2E isolados e limpeza garantida. |
| [ ] | T54 | Revisão de stock, consumos, cancelamentos e reconciliação | P1 | Confirmar que todas as transições actualizam stock e movimentos exactamente uma vez; concorrência entre POS/cozinha; regras de stock ilimitado; relatórios reconciliáveis com movimentos e pedidos; testes de invariantes. |
| [ ] | T55 | Decisão de produto e arquitectura para operação offline | P1 | Manter explicitamente offline apenas para assets/UI informativa ou desenhar fila durável transaccional; não prometer sincronização. Se avançar: idempotência server-side, ordenação, conflitos, expiração, segurança local, retry/backoff, reconciliação e testes de perda de rede. |
| [ ] | T56 | Auditoria funcional de saldos, senhas, carregamentos e fechos de caixa | P1 | Mapear regras de negócio e estados; testar arredondamentos, limites, saldo zero/negativo, estornos parciais/totais, transferência entre eventos, arquivo/recuperação e fecho/reabertura; relatórios batem certo com ledger. |
| [ ] | T57 | Auditoria visual e UX de todos os ecrãs e dispositivos | P2 | Rever administração, POS, cozinha, cliente, público e autenticação em telemóvel/tablet/desktop; estados vazios/loading/erro/sucesso; consistência do design system, acessibilidade e prevenção de acções destrutivas acidentais. |
| [ ] | T58 | Acessibilidade e usabilidade por teclado/leitor de ecrã | P2 | WCAG 2.2 AA como alvo; foco visível, labels, contraste, navegação por teclado, diálogos, tabelas e feedback; testes automatizados e revisão manual dos fluxos críticos. |
| [ ] | T59 | Validação real dos Dockerfiles e Docker Compose | P1 | Executar builds limpos dos containers a partir da raiz, arranque completo, health checks, migrations e smoke tests; validar volumes, permissões, shutdown e ausência de dependências de ficheiros locais. A validação anterior não substitui docker build real. |
| [ ] | T60 | Recuperar e validar o pipeline de deployment Vercel/VPS | P1 | Resolver quota/acesso Vercel quando possível; confirmar root/build/output/env vars, migrations, crons, health checks, rollback e smoke tests; registar deployment ID/URL e nunca marcar concluído só por build local/CI. |
| [ ] | T61 | Privacidade, retenção e ciclo de vida dos dados | P1 | Inventariar dados pessoais, logs, auditoria, tokens e exports; definir retenção/eliminação, minimização, exportação e controlo de acesso; rever RGPD e subprocessadores com aconselhamento adequado antes de produção. |
| [ ] | T62 | Contratos da API, validação e documentação Swagger | P2 | Rever DTOs, validação, códigos de erro, formatos e compatibilidade frontend/backend; eliminar divergências; documentar autenticação, roles, paginação, limites e exemplos reais; testes de contrato. |
| [ ] | T63 | Testes de carga e capacidade operacional | P1 | Definir cenários realistas de pico de festa; medir concorrência de login, POS, pedidos, cozinha, saldo, stock e sockets; identificar limites de CPU/RAM/BD/Redis; estabelecer metas e relatório reproduzível. |
| [~] | T64 | Gestão de dependências, runtime e cadeia de fornecimento | P2 | Rever Node/npm/Next/Nest/TypeORM/TypeScript e dependências directas/transitivas; validar compatibilidade Node 24 e lockfile reproduzível; tratar alertas Dependabot com testes e política de actualização. A auditoria de produção identifica 4 alertas altos relativos ao mesmo ReDoS de picomatch <=4.0.7, transitivo de TypeORM 1.1.3 → tinyglobby → fdir/picomatch. O GHSA-fc5q-39xc-vjpf não declara versão corrigida; npm audit sugere downgrade major de TypeORM para 0.3.31. Não aplicar downgrade/override especulativo; aguardar patch upstream e manter o alerta visível. |
| [ ] | T65 | Revisão de segurança de ficheiros, uploads, QR e exports | P2 | Confirmar validação de MIME/tamanho/conteúdo, armazenamento privado, nomes seguros, autorização por evento, prevenção de SSRF/path traversal e ausência de dados sensíveis em QR/exports. |
| [ ] | T66 | Revisão de relatórios, métricas e reconciliação operacional | P2 | Definir fonte de verdade para vendas, consumos, estornos, caixa e stock; reconciliar totais por evento/período/operador; testar timezone, intervalos, arredondamentos e exportações. |
| [ ] | T67 | Higiene documental e remoção de informação contraditória | P2 | Alinhar README, PLAN, TODO, AUDIT, PROGRESS, SECURITY, CONTRIBUTING e deployment docs com a implementação actual; remover promessas antigas (offline, disponibilidade, capacidade) sem evidência. |
| [ ] | T68 | Verificação de tarefas antigas e bloqueadores ainda abertos | P2 | Reavaliar T34 (acesso/token Vercel), T35 (tag archive/pre-t17), validação Chrome DevTools MCP e integração Redis; fechar, actualizar ou justificar cada item com evidência actual. |

## Itens já concluídos que continuam a exigir vigilância

- **T36 — rate limit com fallback local:** concluído quanto a não falhar aberto sem qualquer contador; continua a limitação multi-réplica, agora acompanhada por T42.
- **T37 — segurança da BD E2E:** concluído; manter o opt-in, host loopback e sufixo de BD descartável em qualquer novo teste destrutivo.
- **T38 — cache PWA:** concluído quanto a não persistir HTML/RSC autenticado; não equivale a suporte de pedidos/pagamentos offline. A evolução está condicionada a T55.
- **T39 — governação CI/segurança:** concluído; manter Dependabot, CodeQL, Gitleaks e permissões mínimas activos.
- **T40 — redacção de segredos na auditoria:** concluído; T43 valida a cobertura real por domínio.
- **T41 — arquivo de saldos concorrente:** concluído; T45 deve verificar os restantes fluxos financeiros.

## Regras de execução deste backlog

1. Trabalhar por ordem de prioridade e dependências, em lotes pequenos e revistos.
2. Antes de alterar código, confirmar que o problema existe na `main` e identificar o comportamento esperado.
3. Para cada item, registar ficheiros, decisão técnica, testes, migrations e riscos no `PROGRESS.md`.
4. Criar PRs focadas; resolver conflitos rebaseando/reaplicando sobre a `main`, sem apagar trabalho válido.
5. Integrar apenas quando os checks obrigatórios estiverem verdes e não houver comentários críticos por resolver.
6. Alterações à base de dados são permitidas enquanto os dados forem de teste, mas cada migration deve ter testes de instalação/upgrade e plano de rollback quando aplicável.
7. Não activar funcionalidades financeiras/offline nem anunciar capacidades sem idempotência, reconciliação e testes adequados.
8. Deploy só é considerado concluído após confirmação do provider e smoke tests no ambiente publicado.
9. Actualizar o estado deste ficheiro no mesmo PR que conclui cada tarefa; nunca deixar itens concluídos sem evidência.
10. Quando a auditoria demonstrar que um item não se aplica, fechar com a justificação e prova, em vez de criar complexidade artificial.

## Critério global de conclusão do projecto

O projecto só passa a **pronto para beta/produção** quando todos os P0 e P1 aplicáveis estiverem concluídos, os fluxos financeiros e de isolamento multi-evento tiverem testes E2E/concorrência, os backups tiverem sido restaurados com sucesso, os testes de carga tiverem resultados aceitáveis, os deployments e crons estiverem verificados no ambiente real e não existirem vulnerabilidades críticas/altas sem mitigação aceite. Os itens P2/P3 podem continuar no roadmap com risco explicitamente aceite.

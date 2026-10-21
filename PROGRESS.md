# SenhasFestas — Progresso

> Log de sessões. Mais recente no topo.
> Actualizar no fim de cada batch.

## Como usar

- Cada entrada regista: **objectivo**, **feito**, **decisões**, **commits**,
  **gates**, **pendente**.
- Não duplicar aqui o que está no `PLAN.md` (roadmap) ou `REVIEW.md` (critérios).
- Registar decisões que não são óbvias no código — as que um leitor futuro não
  conseguiria inferir.

---

## 2026-10-21 — Pacote partilhado `@senhasfestas/shared` (dívida #13)

**Objectivo**: `TipoAlteracaoPlanta` e as strings de protocolo estavam duplicados
entre o gateway do backend e os hooks do frontend — uma divergência (`'joinEventPlanta'`
vs `'joinPlanta'`) só aparecia em runtime. Extrair para um pacote partilhado e
adaptar CI, deploy e Docker ao monorepo npm workspaces.

**Feito**
- `packages/shared`: workspace com `TipoAlteracaoPlanta`, `CANAIS_REALTIME`,
  `EVENTOS_SOCKET`, `MENSAGENS_ENTRADA`, `roomEvento` e `roomPlanta`. Compila para
  CJS + `.d.ts` (o backend é CommonJS, o frontend faz bundle).
- Backend (`order.gateway.ts`) e frontend (`planta.ts`, `use-order-socket.ts`,
  `use-planta-socket.ts`) passam a consumir o pacote. A API pública de
  `useOrderSocket(refetch, eventId)` **não mudou** — o rename `onMessage` foi só
  interno ao `criarSocketAutenticado` (verificado nos 3 callers).
- Raiz do repositório passou a ser o único sítio com lockfile e manifesto de
  workspaces. `backend/package-lock.json` (stale, pré-workspaces) removido do índice.
- CI, `deploy.sh` e `docker-compose.yml` instalam/buildam pela raiz; `next.config.js`
  ganhou `outputFileTracingRoot` (raiz do repo).
- `scripts/build-shared.js` (postinstall) compila o pacote quando há compilador.

**Decisões**
- **CJS + `.d.ts` em vez de ESM**: uma só forma de distribuição serve o backend
  (CommonJS, não transpila nada fora de `src/`) e o frontend (`moduleResolution:
  bundler`). O `package.json` do shared declara `main`/`types` em `dist`.
- **TypeScript unificado na raiz (5.7.3)**: havia 4 cópias em 3 versões (6.0.3, 5.9.3,
  5.7.3, 5.7.3). O `@nestjs/schematics` exige `typescript >= 6.0.0` como peer, o que
  ocupava a raiz com a 6.0.3 — resolvido com um `overrides` que o alinha na 5.7.3. O
  `postinstall` compila o pacote só se houver compilador (em `--omit=dev` não há, e o
  runtime recebe o `dist` do builder).
- **Docker**: o runtime do backend faz `npm ci --omit=dev`, logo não pode compilar o
  pacote — o `packages/shared/dist` é copiado do builder. O
  `node_modules/@senhasfestas/shared` é um symlink para `packages/shared`: copiar o
  symlink como directório deixava o `require` sem ficheiro de entrada.
- **`outputFileTracingRoot` na raiz do repo**: o standalone passa a espelhar o
  monorepo — o entrypoint é `frontend/server.js`, e `public`/`.next/static` ficam em
  `frontend/`.

**Commits**
- `259ed29` feat(shared): pacote @senhasfestas/shared com contrato de realtime
- `43edff6` refactor(backend): consumir @senhasfestas/shared no gateway
- `cbbef47` refactor(frontend): consumir @senhasfestas/shared nos hooks de socket
- `432a9b1` chore(build): alinhar CI, deploy e Vercel com as workspaces na raiz
- `4565805` build(docker): Dockerfiles com o layout do monorepo
- `319ba16` ci: validar chaves únicas nos documentos
- `HEAD` docs: registar a dívida D13 e actualizar o TODO

**Gates**
- Backend: `tsc` limpo · vitest **489/489** · build OK · lint 4 warnings pré-existentes
- Frontend: `tsc` limpo · vitest **297/297** (15 ficheiros) · build OK · lint limpo
- `npm ci --dry-run` na raiz: exit 0 (e em **cada** commit da série — a série foi
  reescrita para que manifestos e lockfile batam certo em todos)
- Layout do runner replicado localmente (`node frontend/server.js`): `/auth/login` **200**,
  `public` **200**, `/_next/static` **200** — processo terminado e temporários removidos
- Layout do runtime do backend replicado: symlink + `packages/shared/dist` resolvem
  (`roomPlanta('evt-1')` → `event:evt-1:planta`)

**Pendente**
- **`docker build` a verificar** — não há Docker neste ambiente. O layout foi
  replicado e arrancado localmente, mas o build da imagem não correu.
- Push de `main` (T5) continua a exigir autorização explícita.
- Configuração do projecto Vercel (root directory, build command) vive no dashboard —
  não verificável a partir do repositório. O build serverless já não depende do
  `postinstall`: `backend/build.vercel.mjs` corre `npm run build:shared` antes do
  `nest build` (verificado: o bundle esbuild inclui `order:updates`, `planta:updates`,
  `joinEvent`, `joinEventPlanta`, `plantaUpdated`, `orderUpdated`).
- `nest g` não foi exercitado depois do `overrides` do TypeScript (o peer
  `typescript >= 6.0.0` do `@nestjs/schematics` fica violado em declarado).

---

## 2026-10-21 — Revisão final: docs validados, histórico reescrito (bisectável)

**Objectivo**: fechar os pontos da revisão que ficaram por resolver — a
validação automática dos documentos, a coerência manifestos/lockfile em cada
commit, e o build Vercel do pacote partilhado.

**Feito**
- `scripts/verificar-docs.js` + `npm run verify:docs`: chaves únicas na tabela de
  dívida do `PLAN.md`, itens únicos na tabela do `TODO.md` e headings `## ` únicos no
  `PROGRESS.md`. Sai com 1 e a listar o problema (provado: injectar uma linha
  duplicada no `TODO.md` faz o script falhar com a linha exacta). Job novo
  `docs` no `ci.yml`; o `deploy` passou a depender dele.
- **Histórico reescrito** (6 → 7 commits, todos locais): o lockfile da raiz
  antecipava a dependência que só aparecia nos manifests de commits posteriores.
  Agora o commit do pacote partilhado traz já `backend/package.json` e
  `frontend/package.json` com `@senhasfestas/shared: "*"`, e os commits seguintes
  são só de código — em cada commit o manifesto casa com o lock. A série antiga
  ficou em `backup/pre-t17` (nunca foi para o remoto).
- `backend/build.vercel.mjs` passou a correr `npm run build:shared` antes do
  `nest build`: o bundle serverless embute o gateway, que importa o pacote
  partilhado, e não se pode depender do `postinstall` para o `dist` existir.
- `PLAN.md` e `TODO.md` distinguem `D<n>` (dívida técnica) de `R<n>` (item do
  roadmap) — o `D13` e o `R13` não são o mesmo item. A contagem de commits
  pendentes no `TODO.md` foi corrigida.

**Verificado**
- As duas alleged duplicações da revisão **não se reproduzem**: o `PLAN.md` tem
  uma só linha `| 13 |` (a resolvida) e o `TODO.md` uma só linha `T5`. O que
  estava errado era a contagem de commits (28 em vez de 29).
- `npm ci --dry-run` sai 0 em cada commit da série.
- O bundle esbuild do backend inclui as constantes do pacote partilhado.

**Pendente**
- `docker build` (sem Docker), execução real do `ci.yml` (depende de push),
  configuração do projecto Vercel (dashboard).

---

## 2026-10-21 — Revisão final (2.ª ronda): provas, decisão do `overrides`, typecheck do frontend

**Objectivo**: fechar os pontos que a revisão de código deixou em aberto —
`T6`/`T7` sem prova, o `overrides` do TypeScript nunca decidido, a ausência de
`typecheck` no frontend e a bisectabilidade da série do `#13`.

**Feito**
- **`T6`/`T7` — a alegação "sem prova no DOM" não se reproduz.** A prova existe:
  `PROGRESS.md` 2026-10-20 regista o login real (200, cookies `sf_token`/`sf_refresh`
  httpOnly, `localStorage.user`, `/admin` persistente após reload) e o E2E de dois
  contextos (mesa de A visível no DOM de B sem reload, em 2878 ms, banner "mudou
  noutro dispositivo" com a edição local intacta). O `T7` tem até spec commitada
  (`frontend/e2e/planta-realtime.spec.ts`) a correr no job `browser-e2e` do CI. O
  que faltava era a *âncora* da prova na nota do item — corrigida no `TODO.md`,
  com a nota explícita de que a revisão partiu de um falso positivo.
- **`overrides` do TypeScript — decidido: manter.** `npx nest g resource tmpProbe
  --dry-run` sai **0** (anuncia os 9 ficheiros, não escreve nada). E a violação do
  peer `typescript >= 6.0.0` do `@nestjs/schematics@12` **não é do `overrides`**:
  re-resolvendo o lockfile *sem* o `overrides` obtém-se uma árvore **idêntica**
  (TypeScript 5.7.3 na raiz, schematic dedupeado, zero entradas diferentes no
  lock) e o npm também não trava. O `overrides` explicita a resolução e torna-a
  independente das heurísticas de peer do npm. Aceitar TypeScript 6 na raiz
  mudaria o compilador de todo o projecto — não é o que a remoção faria.
- **`typecheck` no frontend**: o script `typecheck` (`tsc --noEmit -p tsconfig.json`)
  existia no backend e não no frontend — o gate era manual. Adicionado ao
  `frontend/package.json` e como step explícito no job `frontend` do CI.
- **Bisectabilidade da série `#13` provada até ao build**: `npm ci` +
  `npm run build:shared` + `nest build` + `next build` + vitest (backend **489/489**,
  frontend **297/297**) em worktrees isolados de `259ed29`, `43edff6` e `cbbef47` —
  os três commits onde o código muda. Os commits seguintes (`432a9b1`, `4565805`,
  `319ba16`, `29b328e`) **não tocam nenhum input de build** (`backend/src`,
  `frontend/src`, `next.config.js`, `packages/`, lockfile): o único delta de
  manifesto é `+1` linha de script na raiz, e o `backend/build.vercel.mjs` não
  entra no `nest build`. O resultado é herdado de `cbbef47`, por inputs
  idênticos.

**Verificado**
- `npm run verify:docs` verde; YAML do `ci.yml` válido (5 jobs);
  `npm run typecheck` exit 0 no frontend e no backend.
- Worktrees e temporários removidos; `git status --short` vazio.

**Pendente**
- `docker build` (sem Docker), execução real do `ci.yml` (depende de push),
  configuração do projecto Vercel (dashboard), push de `main` (T5).

---

## 2026-10-21 — Cron externo de limpeza de tokens (`/api/cron/cleanup-tokens`)

**Objectivo**: o `@Cron cleanupExpiredTokens` (3AM) não dispara em serverless — havia
322 tokens expirados e 187 revogados >30d por apagar. Fechar a via de limpeza onde a
app realmente corre (Vercel).

**Feito**
- `CronController`: novos `GET`/`POST /api/cron/cleanup-tokens` que chamam
  `AuthService.cleanupExpiredTokens()`, com o mesmo gating `CRON_SECRET`
  (`Authorization: Bearer` do Vercel ou `x-cron-secret` manual).
- `CronModule` importa `AuthModule` (`AuthService` já era exportado; sem ciclo — o
  `AuthModule` não importa o `CronModule`).
- `vercel.json`: entrou `/api/cron/cleanup-tokens` → `0 3 * * *`.
- `cron.controller.spec.ts` (novo, 7 testes): recusa sem `CRON_SECRET`/segredo errado,
  aceita Bearer e `x-cron-secret`, devolve contagem, zero sem falhar, e **verifica
  antes de agir** (não chama o serviço se não autorizado).

**Decisões**
- **Só a via HTTP, sem duplicar o `@Cron`**: mantém-se o `@Cron` para o deploy por
  processo (`main.ts`), o endpoint cobre serverless. Os dois convergem no mesmo
  `AuthService.cleanupExpiredTokens()` — uma só implementação.
- **Reutilizar o padrão existente** (`close-events`/`archive-balances`) em vez de
  inventar outro mecanismo; o `assertAutorizado`/`safeEqual` são partilhados.

**Gates (backend)**: `tsc` limpo · vitest **489/489** (+7) · build OK · lint 4
warnings pré-existentes (nenhum novo). **Verificado em boot real** (`:3011`):
`CronModule dependencies initialized`, rotas `cleanup-tokens` GET/POST mapeadas,
`GET` sem segredo → **403** (não 404).

**Commit**: `feat(cron): endpoint /api/cron/cleanup-tokens para limpeza em serverless`.

**Pendente**: T10 (push de `main`, autorização).

---

## 2026-10-21 — Dívida #14: indicador de realtime na planta

**Objectivo**: paridade com o `useOrderSocket` — expor o `status` da ligação de
planta para um badge, em vez de o utilizador só descobrir o realtime em baixo pelo
409.

**Feito**
- `use-planta-socket.ts` devolve `{ status: OrderSocketStatus }`.
- `criarSocketAutenticado` (em `use-order-socket.ts`) generalizado com
  `roomEvent`/`mensagem`/`onMessage` — deixa de ser específico de pedidos e passa a
  ser o motor dos dois hooks (uma só implementação de reconexão/re-auth). `onMessage`
  recebe o payload; a validação (`plantaId` string) fica no `usePlantaSocket`.
- `admin/page.tsx` (tab da planta): badge de realtime junto à contagem de mesas —
  verde "Realtime ligado" / âmbar "a reconectar…" / vermelho "Sem realtime"; oculto
  quando `disabled` (sem evento ou sem `NEXT_PUBLIC_WS_URL`).
- Testes: `use-planta-socket.test.tsx` +2 (`disabled`→`connected`; `disconnect`→
  `reconnecting`); `use-order-socket.test.ts` adaptado ao novo `onMessage`.

**Decisões**
- **Reutilizar o motor em vez de duplicar**: a lógica de reconexão infinita,
  `connect_error`→refresh e badge era idêntica; generalizar evita duas cópias a
  divergir (o bug clássico de indicadores de socket).

**Gates (frontend)**: `tsc` limpo · vitest **297/297** (+2) · build OK · lint limpo.
Backend não tocado.

**Commit**: `feat(frontend): indicador de realtime no canal de planta (#14)`.

**Escolha de task**: B (integração Redis do gateway) foi **saltada** — sem docker/
redis-server nesta máquina, não é verificável ("não inventar"). Fica para quando
houver Redis acessível.

**Pendente**: T10 (push de `main`, autorização).

---

## 2026-10-20 — CI: job browser-e2e (realtime da planta)

**Objectivo**: tornar a suite browser repetível em CI e bloquear regressões de
realtime antes do deploy.

**Feito**
- Novo job **`browser-e2e`** em `.github/workflows/ci.yml`: serviços Postgres+Redis,
  `npm ci` (backend+frontend), `playwright install --with-deps chromium`, build de
  ambos, `migration:run` (o schema não é auto-criado fora de produção), arranque de
  backend (`:3000`) e frontend (`:3001`), `wait-on` em `/api/health` e
  `/auth/login`, e `playwright test planta-realtime.spec.ts security-headers.spec.ts`.
  O admin é semeado por `BOOTSTRAP_ADMIN_EMAIL/PASSWORD` (o
  `BootstrapAdminService` cria-o no arranque).
- `deploy` passou a `needs: [backend, frontend, browser-e2e]`.

**Decisões**
- **`E2E_CHANNEL=chromium`** (browser do Playwright, não `chrome`/`msedge` do
  sistema): o runner do GitHub não tem esses; o Playwright instala o seu.
- **`session.spec.ts` fica fora do job**: exige `E2E_CLIENT_*` (uma conta de
  cliente), que o bootstrap não cria. O job cobre planta-realtime + security-headers.
- **Migrações explícitas antes do boot**: `migrationsRun` só corre em
  `NODE_ENV=production`; em `test` o schema tem de ser criado à parte.

**Verificação local**: a config exacta do CI (`E2E_CHANNEL=chromium`, os dois
specs) corre localmente com **2 passed** (planta-realtime ~46 s + security-headers),
com backend `:3000` e dev `:3001`. `e2e-planta-*` confirmado ausente no fim.

**Commits**: `ci: job browser-e2e (realtime da planta) com Chromium e serviços`.

**Pendente**: T10 (push de `main`, autorização).

---

## 2026-10-20 — Suite Playwright do realtime da planta (T7 repetível)

**Objectivo**: transformar o E2E ad-hoc de T7 numa spec reutilizável e correr a
suite localmente com prova verde.

**Feito**
- `frontend/e2e/planta-realtime.spec.ts` (novo): dois contextos de browser num
  evento `e2e-*` descartável (criado por API, apagado no `finally`). Prova:
  A adiciona uma mesa → B vê-a aparecer **sem reload** (via socket); com edição
  local em B, A grava outra → B mostra o aviso "mudou noutro dispositivo" e a mesa
  local **não** se perde. Segue a convenção da suite (credenciais do env, sem
  segredos em código, `E2E_BASE_URL` obrigatório).
- Corrida local: **1 passed (46.5s)** com backend `:3000` e dev `:3001`
  (`E2E_CHANNEL=chrome`). Evento `e2e-planta-*` confirmado ausente no fim (0).

**Decisões**
- **Não ligar ao CI neste batch**: exige orquestrar backend+frontend+Postgres+
  Redis+Chromium num job e uma política de flakiness — decisão de processo, não de
  código. Fica registada como pendente no `PLAN.md` (#5) e no `TODO.md`.
- Sem credenciais em código: reutiliza `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` como
  `session.spec.ts`; a criação do evento usa a API com Bearer (não a UI).

**Commits**: `test(frontend): suite Playwright do realtime da planta (dois contextos)`.

**Gates**: `tsc` 0 erros (spec incluída no `tsconfig`); Playwright 1/1 verde local.

**Pendente**: ligar a suite browser ao CI (decisão), T10 (push, autorização).

---

## 2026-10-20 — T6 (login dev), T7 (E2E UI dois contextos) e T8 (spec do hook)

**Objectivo**: fechar os gaps da revisão v3 — provar que o login em dev funciona,
provar a adopção/aviso no DOM e cobrir o hook de socket.

**Feito**
- **T6 — não é bug**. Script Playwright: login real → `POST /api/auth/login 200`,
  cookies `sf_token`/`sf_refresh` presentes no contexto (httpOnly, SameSite=Lax,
  secure=false) e `localStorage.user` gravado. Com `waitForURL` (em vez de
  `waitForTimeout` fixo) a navegação para `/admin` acontece e **persiste após
  reload**. Veredicto: (a) era **timing do teste**, não falha de auth. Nota: o
  `set-cookie` não aparece em `res.headers()` do Playwright (o CDP omite-o), mas
  os cookies provam que o rewrite Next **propaga** o `Set-Cookie`.
  **Armadilha encontrada**: um dev server com hot-reload estragado
  (`__webpack_modules__[moduleId] is not a function`) serve o HTML mas não hidrata
  o React — clicar em "Entrar" faz submissão nativa do form para `/auth/login?` e
  nunca chama a API. **Limpar `.next` e reiniciar** resolve. Não é bug do produto.
- **T7 — E2E UI de dois contextos (verde)**. Dois browsers independentes, login real,
  `/admin` → tab Planta → mesmo evento `e2e-<ts>` (criado e apagado no fim, **nunca**
  `festa-teste-2026`). Resultado: `A_criou_mesa=true`; `B_adotou=true` em **2878 ms**
  (mesa nova apareceu no DOM de B **sem reload**, via socket); com edição local em B,
  A grava → `B_avisou=true` (banner "mudou noutro dispositivo") e
  `B_manteve_edicao=true` (a mesa local de B não se perdeu). Limpeza: DELETE 200 →
  GET 404; eventos `e2e-planta-*` das tentativas falhadas também removidos.
  `festa-teste-2026` confirmado intacto (`Principal v30`, sem novas alterações).
- **T8 — `use-planta-socket.test.tsx`** (novo, 8 testes, jsdom): liga com token
  actual e entra no `connect`; re-entra no `reconnect`; reemite `plantaUpdated`
  válido; ignora payload malformado (sem `plantaId`) e `null`; usa sempre o callback
  mais recente sem recriar socket; desliga no unmount; não abre socket sem `eventId`
  nem sem `NEXT_PUBLIC_WS_URL`.

**Decisões**
- O E2E dirige a UI real (adicionar mesa pela toolbar) e observa a adopção pelo DOM
  (`.planta-mesa`), em vez de arrastar no canvas — mais estável e prova o wiring
  socket→hook→`tratarPlantaRemota`→`adoptarPlantaRemota`.
- E2E sempre com evento próprio descartável; limpeza verificada (GET 404 no fim).

**Commits**: `41077d8 test(frontend): spec do usePlantaSocket`.
(T6/T7 são verificações; sem commit de produção.)

**Gates**: frontend — `tsc` 0 erros · vitest **295/295** (+8) · `build` OK · lint limpo.

**Pendente**: T10 (push de `main`, requer autorização), #5 (cdt), #13 (bump mcp).

---

## 2026-10-20 — Revisão v3 do batch T1–T4b/T3: correcção de doc e dívidas

**Objectivo**: fechar os pontos levantados na revisão do batch antes de qualquer push.

**Feito**
- **T9** (`PLAN.md`, nota serverless): a nota afirmava que o `serverless.main.ts`
  "não regista o `OrderGateway`" — **falso**. O ficheiro reutiliza `criarAplicacao`
  (linha 3) e o `AppModule` importa `WebSocketModule` (`app.module.ts:59`), logo o
  gateway **é instanciado**. A causa real é o runtime serverless não suportar WS
  persistentes nem fan-out entre invocações. Nota corrigida com a causa correcta.
- Dívidas 13/14/15 registadas na tabela `PLAN.md`: tipo duplicado backend/frontend,
  `use-planta-socket` sem indicador de estado, e `version` 1→30 da planta real de
  `festa-teste-2026` por E2E socket.

**Decisões**
- A correção de doc prova-se lendo os ficheiros (não só `ls`): `serverless.main.ts:3`
  chama `criarAplicacao`; `app.module.ts:59` importa `WebSocketModule`. É a lição da
  revisão — não escrever causa sem ler a linha.

**Commits**: (este) `docs(plan): corrigir causa do WS em serverless e registar dívidas`.

**Gates**: nenhum código tocado (só docs).

**Pendente**: T6 (diagnóstico do login em dev — pode ser P0), T7 (E2E UI de dois
contextos), T8 (spec do `use-planta-socket`), T10 (push, requer autorização).

---

## 2026-10-20 — Frontend #12: planta em realtime (T3)

**Objectivo**: consumir no `/admin` o `plantaUpdated` emitido pelo backend, sem
perder edições locais nem somar polling.

**Feito**
- `frontend/src/lib/use-planta-socket.ts` (novo): liga a `NEXT_PUBLIC_WS_URL`,
  emite `joinEventPlanta` no `connect`/`reconnect` e reemite `plantaUpdated`; a
  auth segue o padrão do `use-order-socket` (token do `getAccessToken`).
- `frontend/src/lib/planta.ts`: `decidirAdocaoRemota` (helper puro) + tipos
  `TipoAlteracaoPlanta`/`EventoPlantaRemota`/`DecisaoAdocaoRemota`.
- `admin/page.tsx`: `tratarPlantaRemota` chama o helper e aplica a decisão —
  `adoptar` → GET + aplica com guards de eco/edição local; `avisar` → banner com
  "Recarregar" (guarda a edição local como pendente antes de adoptar) e "Ignorar";
  `refetch-lista` → limpa `plantaId` e re-pede a lista (renomeada/apagada).

**Decisões**
- **`tipo` ausente = refetch da lista**: uma mensagem antiga sem `tipo` cai no ramo
  estrutural por segurança (não se assume que é um update inofensivo).
- **Aviso, não adopção, quando há trabalho local**: a rota `avisar` preserva sempre
  as edições por sincronizar; o "Recarregar" do aviso grava-as como pendente
  (recuperáveis pelo aviso de pendentes) antes de adoptar o servidor.
- **Sem polling**: o socket complementa o 409 existente; nada de `setInterval` novo.

**Commits**: `9e10b37 feat(frontend): receber plantaUpdated em realtime (adopta ou avisa)`.

**Gates**: frontend — `tsc` 0 erros · vitest **287/287** (+9) · `build` OK · lint
limpo. E2E real (socket.io, backend `:3000`, dois clientes management):
login → ambos `joinEventPlanta` → PATCH renomear → ambos recebem
`{plantaId, version, tipo:'renomeada'}`. Estado de `festa-teste-2026` reposto
(planta renomeada de novo para "Principal").

**Pendente**: T5 (push de `main`, requer autorização explícita; `main` com 11
commits locais à frente de `origin/main`).

---

## 2026-10-20 — Contrato `tipo`, room de planta restrita e auditoria de docs (T1–T4b)

**Objectivo**: fechar a análise aberta sobre o #12-backend — desambiguar o rename
(que não incrementa `version`), restringir o canal de planta a `MANAGEMENT_ROLES`,
provar a DI nova, e arrumar dívida de docs/segurança antes do push.

**Feito**
- **T1** — `emitPlantaUpdate(eventId, plantaId, version, tipo)`; `tipo` é
  `'criada'|'guardada'|'renomeada'|'apagada'` (union exportada `TipoAlteracaoPlanta`).
  As 5 emissões no `floor-plan.service.ts` passam o tipo (criar/guardar/renomear/
  apagar/guardarPrincipal).
- **T1** — a emissão passa a usar a room `event:<id>:planta`, reservada a
  `MANAGEMENT_ROLES`. Novo handler `joinEventPlanta` reutiliza
  `MembershipService.roleEfetiva` (herda o bypass de superadmin) e verifica a
  membership **antes** do rate-limit, para não gastar tentativas nem distinguir
  existência por erro. A room geral do evento (`event:<id>`, dos pedidos) deixa de
  receber metadados de planta.
- **T2** — `backend/src/websocket/order.gateway.spec.ts` (20 testes): emissão local
  vs. publish com `subscriberAtivo`, teste negativo de room (nunca `event:<id>`),
  wiring `ready`/`end` do subscriber (via mock do `ioredis`), join restrito
  (superadmin/organizer entram; kitchen/estranhos não) e a ordem
  membership-antes-do-rate-limit.
- **T4b** — auditoria de segredos: só `.env.example` estão tracked; os `.env` reais
  (raiz, backend, frontend) estão gitignored e nunca aparecem na história;
  `admin123` vive só no `.env` local (gitignored). `.github/workflows/ci.yml` cobre
  lint, testes, build, e2e (Postgres+Redis) e migrações no deploy.
- **T4** — removido heading duplicado no `PROGRESS.md` (bloco órfão 234-237);
  criado `TODO.md` (índice estado/prioridade/dependências); registada no `PLAN.md`
  a limitação "WebSocket indisponível em serverless".

**Decisões**
- **Room dedicada em vez de reutilizar `event:<id>`**: separa autorização de
  transporte. O `joinEvent` continua aberto a qualquer membro (pedidos/KDS precisam),
  e só management entra no canal de planta. Não foi preciso tocar no realtime de
  pedidos.
- **`tipo` no payload**: resolver sem `version` não permite distinguir um rename
  (não incrementa `version`) de um ping de no-op. O `tipo` desambigua
  rename/delete/update sem mexer na semântica 409 do PUT.
- **Membership antes do rate-limit**: a ordem contrária gastava tentativas de
  não-membros e devolvia "Demasiados pedidos" em vez de "Não pertence", revelando
  existência do evento.
- **WebSocket serverless**: documentado em vez de "corrigido". O entrypoint
  serverless não regista o gateway; quem quer realtime usa o `main.ts`.

**Commits**: `13d0ca4 feat(backend): tipo e room restrita no plantaUpdated` ·
`6896af2 test(backend): spec do OrderGateway (fallback Redis e join de planta)` ·
commit de docs (heading duplicado + `TODO.md` + nota serverless).

**Gates**: backend — `tsc` 0 erros · vitest **482/482** (+20) · `build` OK · lint 4
warnings pré-existentes · boot `:3011` com `Nest application successfully started`
(DI de `MembershipService` resolvida, sem `can't resolve`).

**Pendente**: T3 (frontend #12 realtime — `joinEventPlanta`, `decidirAdocaoRemota`,
eco, `tipo !== 'guardada'` → `getPlantas`).

---

## 2026-10-20 — Planta em realtime (roadmap #12, backend)

**Objectivo**: emitir um aviso quando uma planta muda, para outros dispositivos
do mesmo evento o saberem sem dependerem do 409 no próximo PUT. Âmbito desta
batch: **só backend** (o frontend fica para batch própria).

**Feito**

- `websocket/order.gateway.ts`: canal `planta:updates` + `emitPlantaUpdate(eventId,
  plantaId, version)`; o subscriber Redis passou a subscrever `order:updates` e
  `planta:updates` e a distinguir por canal, re-emitindo `plantaUpdated`
  (`{plantaId, version}`) para a room `event:<id>`. O evento **não** leva o
  documento.
- `modules/event/floor-plan.service.ts`: injecção do `OrderGateway` e emissão
  depois de cada mutação bem-sucedida — `criar`, `guardar`, `renomear`, `apagar`,
  `guardarPrincipal`. Nos `throw` (409/404/400) não emite.
- **Robustez (bug pré-existente)**: `emitOrderUpdate`/`emitPlantaUpdate` só
  publicam no Redis quando o subscriber está efectivamente `ready`
  (`subscriberAtivo`); com Redis em baixo caem na emissão local directa. Antes,
  com `REDIS_URL` definido mas Redis inacessível, o `publish` falhava e o evento
  era perdido — reproduzido no E2E com Redis parado.
- `floor-plan.service.spec.ts`: mock do gateway, actualizadas as 4 construções e
  testes de emissão/não-emissão em criar e guardar + asserts em renomear/apagar/
  guardarPrincipal.

**Verificação**

- Gates backend: `tsc` limpo · vitest **462/462** (antes 458; +4) · `build` OK ·
  `lint` (4 warnings pré-existentes, nenhum novo).
- E2E real (socket.io + HTTP, evento temporário apagado no fim): login → cliente
  socket faz `joinEvent` na room → `PATCH` renomear planta → chega
  `plantaUpdated {plantaId, version}` correctos. Corrido com Redis parado, o que
  prova o caminho de fallback local (sem a correcção, não chegava nada).

**Decisões**

- Reutilizar o `OrderGateway` (mesma auth/rooms/membership/rate-limit) em vez de
  criar um segundo gateway: `WebSocketModule` é `@Global` e já exporta o gateway.
- O evento transporta só `{plantaId, version}`; o cliente decide se refaz o GET
  (evita acoplar o WS ao formato do documento e a payloads grandes).

**Pendente**

- Frontend: subscrever `plantaUpdated`, adoptar a versão remota quando não há
  edições locais por sincronizar; senão manter o painel de conflito actual.

---

## 2026-10-20 — Multi-planta (roadmap #11)

**Objectivo**: várias plantas por evento (salão + esplanada), deixando de haver
uma única `events.floorPlan`.

**Backend**

- Tabela `floor_plans` (`1790600000000-CreateFloorPlans`): `eventId` (FK
  `ON DELETE CASCADE`), `nome` único por evento, `documento` JSONB, `version`,
  timestamps. Backfill `"Principal"` a partir de `events.floorPlan`/`floorPlanVersion`
  e limpeza das colunas antigas; `down()` reconstrói as colunas e repõe a
  `"Principal"`. A migração **foi corrida** contra a BD Neon.
- `FloorPlanEntity`; `EventEntity` perde `floorPlan`/`floorPlanVersion`.
- `FloorPlanService` (novo) com `listar/criar/obter/guardar/renomear/apagar` e os
  compat `obterPrincipal/guardarPrincipal`. Helpers de documento movidos do
  `EventService` (`lerFloorPlan`, `normalizarZonaPlanta`, `normalizarDimensoes`,
  `clampNumero`, `ehViolacaoUnica`).
- `FloorPlanController` (novo): 8 rotas sob `/events/:id/plantas` (a última não
  pode ser apagada → 400; nome duplicado → 409; `PUT` com `version` divergente →
  409) e o compat `/events/:id/planta` sobre a linha `"Principal"`.
- Auditoria: regra de segmento `plantas` → acção `PLANTA` no interceptor (o
  sufixo `/planta` do compat cai na mesma regra).

**Frontend**

- `lib/api.ts`: `getPlantas`, `criarPlanta`, `getPlanta(eventId, plantaId)`,
  `guardarPlanta(eventId, plantaId, dados)`, `renomearPlanta`, `apagarPlanta`
  (`PlantaResumo`); removidos os wrappers compat-only.
- `lib/planta.ts`: `chaveCachePlanta`/`chavePlantaPendente` passam a aceitar id
  (`sf:planta:<sc>[:<id>]`), `chavePlantaAtiva(sc)` guarda a última planta
  conhecida por evento, `chaveContextoPlanta(sc, id)` dá a identidade das refs em
  memória (legado sem id = `legado:<sc>`), e `migrarChavesLegadasPlanta` copia
  legacy→id (só se a nova não existir) e remove sempre a legacy.
- `admin/page.tsx`: efeito de lista (auto-cria `"Principal"` só se vazio e o
  separador estiver aberto ou houver pendente legado; 404 do GET por id volta a
  pedir a lista), efeito de carga por planta com save adiado/pendente por
  contexto, `podeEditarPlanta` bloqueia edições enquanto a lista não resolve, e o
  arranque usa já a última planta guardada (paraleliza lista + carga) com guarda
  para não adoptar documento de outro evento. UI: selector de planta, botões
  Nova/Renomear/Apagar (desactivado com uma só planta) e diálogo único.

**Decisões**

- Versão-base e pendente são **por planta** (`legado:<sc>` enquanto o id não é
  conhecido), não por evento como antes — era a única forma de duas plantas do
  mesmo evento não partilharem versão.
- `migrarChavesLegadasPlanta` corre **sempre** que a lista resolve, não só com
  lista nova: um pendente legado do evento actual ficaria invisível para sempre.
- Auto-criar `"Principal"` fica atrás de (`activeTab === 'planta'` ou pendente
  legado) para não escrever no backend só por abrir o admin sem visitar o
  separador.

**Feito e verificado**

- Gates backend: `tsc` limpo, `vitest` **458/458**, `build`, `lint` (4 warnings
  pré-existentes).
- Gates frontend: `tsc` limpo, `vitest` **278/278**, `build`, `lint` sem avisos.
- Playwright (Chrome headless, evento temporário apagado no fim): auto-criação da
  `"Principal"`; editar a Principal e criar `"Esplanada"` sem perder a primeira;
  mesa por planta; renomear; reload mantém a planta activa e o cache por id;
  apagar a segunda volta à Principal e limpa o cache; botão Apagar desactivado com
  uma só planta. Sem tocar em `festa-teste-2026`.

**Pendente**

- Nada funcional. Revisão de batch na entrada seguinte.

---

## 2026-10-20 — Revisão de batch do #11 (multi-planta)

Revisão lançada a dois subagentes (`backend-specialist` + `frontend-specialist`).

### O que está bem

- **Migração aditiva e reversível**: `1790600000000-CreateFloorPlans` cria
  `floor_plans`, faz backfill da `"Principal"` a partir de
  `events.floorPlan`/`floorPlanVersion` e só então remove as colunas antigas;
  `down()` reconstrói as colunas e repõe a `"Principal"`. Registada em
  `migrations/index.ts`. Corrida contra a BD Neon (facto: output do script).
- **Isolamento por planta do optimistic locking**: `version` vive na linha da
  tabela, não no evento — duas plantas do mesmo evento não partilham versão
  (`floor-plan.service.ts`, `guardar`).
- **Contrato HTTP consistente** (`floor-plan.controller.ts`): 409 em `PUT` com
  `version` divergente e em nome duplicado; 400 ao apagar a última planta;
  compat `/events/:id/planta` sobre a linha `"Principal"`.
- **Frontend — guard pós-await**: `enviarPlantaContexto`/efeito de carga fecham
  com guarda por `chaveContextoPlanta`/`plantaArranque`; nenhum caminho async
  escreve estado de outro evento (linhas ~1310, ~1371 em `admin/page.tsx`).
- **Helpers puros testados**: `lib/planta.ts` (chaves por planta, migração de
  legacy) com `planta.test.ts` — 128/128.

### O que está mal / a verificar

- [corrigido] ⚠️ **Catch 404 apagava a preferência de outro evento**: sem o guard
  `lerPlantaAtiva() !== plantaArranque` antes de limpar `sf:planta-ativa`, um GET
  404 de um id herdado de outro evento apagava a planta activa do evento
  destino. Reposto o guard (linha ~1371); provado por E2E — com o guard removido
  o caso 6 falha.
- [corrigido] ⚠️ **Diálogo sem estado de processamento**: `confirmarPlantaDialogo`
  não bloqueava duplo clique nem `Enter` repetido. Acrescentado
  `plantaDialogoAProcessar` (guarda no início, `loading`/`disabled` nos botões,
  `finally`).
- [corrigido] ⚠️ **Closure de `plantas` na remoção**: o ramo `apagar` computava
  `restantes` a partir da closure e fazia `setPlantas(restantes)` — passível de
  reverter uma lista actualizada entretanto. Trocado por actualização funcional
  `setPlantas((prev) => prev.filter(...))`.
- [corrigido] ⚠️ **Erro do diálogo sem `role="alert"`**: leitor de ecrã não
  anunciava. Acrescentado.
- [a verificar] A análise do subagente backend chegou truncada; os pontos de
  `down()`/FK `ON DELETE CASCADE`/unique `(event, nome)` foram lidos no código,
  não confirmados por execução da migração inversa.

### O que acrescentar

- Teste de integração do efeito que chama `decidirPlantaRemota`/`migrarChaves…`
  (a cobertura actual é de helpers puros + E2E).
- Alternativa ao `role="alert"` dentro do `<Dialog>` se o `Dialog` passar a gerir
  `aria-describedby`.
- [a verificar] Confirmar comportamento do compat `/planta` quando não existe
  linha `"Principal"` mas existem outras (hoje: PUT cria; GET devolve vazio).

### Veredicto

Sólido; correcções aplicadas e gates verdes. Pode avançar. Dívida nova: nenhuma
crítica — as duas notas "a acrescentar" são melhorias, registadas aqui.

---

## 2026-10-20 — Select "Agrupar por" recalcula os grupos (revisão do #8)

**Objectivo**: fechar as pontas da revisão do #8 — a armadilha do selector e o
estado divergente entre o selector da planta e o lote manual.

**Feito**
- `loteOrigem: 'planta' | 'manual' | null`; `prepararLotePlanta(modo)` extraído de
  `gerarQrsDaPlanta`; `gerarQrsDaPlanta(modo = loteAgrupar)`.
- Selector "Agrupar por": ao **entrar** em "Zona" com lote da planta já gerado →
  recalcula (`gerarQrsDaPlanta('zona')`); ao **sair** → limpa grupos. Antes: só
  limpava ao sair, ficando "Zona" com folhas em chunks.
- `gerarLote` (diálogo de QRs): marca origem `manual`, limpa grupos e repõe o
  selector em "Ordem da planta" — senão ficava "Zona" sem grupos nenhuns.
- `descartarLote` limpa também a origem; falha do `gerarLote` limpa grupos/origem.
- Botão "Gerar QRs das mesas" passa a `onClick={() => gerarQrsDaPlanta()}` — sem
  isso o evento do click era o argumento `modo`.
- Lugares já ajustados no painel sobrevivem ao recálculo (merge
  `prev[mesa] ?? lugares[mesa] ?? loteLugaresPadrao`).

**Verificação** (Playwright, Chrome real, `:3001` com build novo;
`festa-teste-2026`)
- Gerar com "Ordem da planta" → 1 folha sem títulos; mudar **só o selector** para
  "Zona" → 2 folhas: "Zona 1" (Mesa A) e "Sem zona" (Mesa B, C). Volta a "Ordem
  da planta" → 1 folha; reentrada em "Zona" → 2 folhas.
- PDF com `data-print='lote'` → 2 páginas; ordem no DOM (define as quebras):
  Zona 1 → Sem zona. **Texto do PDF não extraído** (fontes subsetadas do Chrome).
- Lote manual no diálogo de QRs com o selector em "Zona" → selector passa a
  "Ordem da planta", 1 folha sem títulos.
- `:3001` morto e scripts temporários removidos no fim.

**Decisão (do utilizador)**: manter "Imprimir → Guardar como PDF" (zero
dependências); `jspdf` descartado por agora. Push de `main` autorizado.

**Commits**: `3eb9ede fix(frontend): recalcular grupos do lote ao mudar Agrupar por`.

**Gates**: `tsc` 0 erros · vitest 273/273 · lint limpo · `build` OK.

**Pendente**: nenhum para o #8. Seguinte: #11 multi-planta.

---

## 2026-10-20 — Export PDF por zona (roadmap #8)

**Objectivo**: o gerador de QRs em lote ordenava por zona mas as folhas eram
chunks de `colunas × linhas`, podendo misturar zonas e partir zonas no meio de uma
folha. Uma zona por folha.

**Feito**
- `lib/qr-lote.ts`: `agruparFolhasPorZona(grupos, porFolha)` (uma folha por zona,
  `titulo` repetido quando a zona não cabe, zonas vazias não geram folha) — 5 testes.
- `components/admin/qr-folhas.tsx`: componente `QrFolhas` com a folha + QRs +
  título (antes havia o mesmo JSX duplicado no preview e na área de impressão).
- `admin/page.tsx`: estado `loteGrupos` (grupos fixados **no momento da geração**,
  a partir de `agruparMesasPorZona`); memo `folhasLote` (por zona se houver
  grupos, senão o chunking de sempre); o selector "Agrupar por" limpa os grupos
  quando se volta a "Ordem da planta"; `descartarLote`/`gerarLote` limparam
  também.
- `globals.css`: `.qr-sheet-titulo` (ocupa a linha toda do grid; claro em ecrã,
  preto no print).

**Decisões**
- Sem dependências novas: "Imprimir" continua a ser o botão e o browser dá
  "Guardar como PDF" (já há `@page A4`, `body[data-print='lote']` e
  `break-after: page` — só faltava o título e o agrupamento por zona).
- Os grupos entram no estado do lote, não são recalculados na impressão: se a
  planta mudar depois de gerar os QRs, o lote impresso não muda (como já
  acontecia com `loteGerado`).

**Verificação** (Playwright, Chrome real, `:3001` com build novo; evento
`festa-teste-2026`): "Agrupar por → Zona" + "Gerar QRs das mesas" → 2 folhas —
"Zona 1" com a Mesa A; "Sem zona" com as Mesas B e C; `page.pdf()` com
`data-print='lote'` → **2 páginas**; voltando a "Ordem da planta" → 1 folha sem
títulos. Instância morta e script temporário removido no fim.

**Commits**: `7ec86f8 feat(qr): uma folha por zona no lote de QRs (roadmap #8)`.

**Gates**: `tsc` 0 erros · vitest **273/273** (eram 268, +5) · lint limpo ·
`build` OK.

**Pendente**: nenhum para o roadmap #8. (Dívida nova: nenhuma.)

---

## 2026-10-19 — Auditoria com `before` em todas as rotas de escrita (dívida #1)

**Objectivo**: fechar a dívida #1 — o interceptor global de auditoria já capturava
o `after` (resultado) mas só o PUT da planta capturava o `before` (estado anterior).
Estender o mecanismo às restantes rotas de escrita, sem duplicar registos (o serviço
não volta a chamar o `AuditService`).

**Feito**
- **Interceptor** (`audit.interceptor.ts`): novos símbolos `AUDIT_DETAILS_EXTRAS`,
  `AUDIT_EVENT_ID` e `AUDIT_ENTITY_ID`; `definirAuditBefore(req, antes, extras?)` passa
  a fundir `extras` em `details`; novos `definirAuditEvento(req, eventId)` e
  `definirAuditEntidade(req, entityId)`; interface `SnapshotAuditoria`
  (`{ antes?, eventId?, entidadeId?, extras? }`); helper `arquivarAuditoria(req)` que
  fecha os três setters (os controllers limitam-se a passá-lo). `eventoEfetivo`/
  `entidadeEfetiva` = `override ?? base` garantem que um override ausente (`undefined`)
  não apaga o valor derivado do path/body.
- **Evento `eventId`**: o interceptor deriva-o de `req.params.eventId`/`req.body.eventId`.
  Rotas como `PATCH /products/:id/stock`, `PATCH kitchen/orders/:id/status`,
  `POST /cash-closure/:id/fechar` e `PATCH /events/:id*` não o trazem → o serviço
  passa `eventId` explicitamente (produto→evento, pedido→evento, caixa→evento) para o
  log não sair do escopo do tesoureiro.
- **Rotas passam a arquivar `before`** (o serviço constrói o snapshot; o controller
  passa `arquivarAuditoria(req)`):
  - `catalog`: `PATCH /:id`, `DELETE /:id` (o stock já tinha sido migrado antes).
  - `cash-closure`: `POST /:id/fechar` (migrado antes) e `POST /abrir` (unificado:
    era o último ponto a gravar `CREATE` pelo `AuditService` **e** `OPEN` pelo
    interceptor; fica só o `OPEN`, com `entityId` = id da caixa via `entidadeId`).
  - `balance`: `load`, `deduct`, `reverse/:movementId`, `transfer` (regista os **dois
    lados** + `extras {fromEventId,toEventId}`), `extend`, `unarchive`, `notified`.
  - `order`: `PATCH /:id/status`, `POST /:id/cancel`.
  - `kitchen`: `PATCH kitchen/orders/:id/status`.
  - `public-screen`: `PATCH public/pedidos/:id/entregue`.
  - `event`: `PATCH /:id`, `PATCH /:id/status`, `PATCH /:id/settings`,
    `POST /:id/members`, `DELETE /:id/members/:userId`, `DELETE /:id`.
  - `user`: `PATCH /:id`, `DELETE /:id` (snapshot via `toPublicUser` — **sem password**).
- Sem `before` (não há estado anterior): `POST` de criação e `POST /import`.
- **Snapshots sem relações pesadas**: em `catalog.update`/`softRemove` e
  `event.update` o snapshot exclui a relação `event`/o campo `floorPlan` — um evento
  com muitas mesas ultrapassava o corte de 8000 chars do interceptor e o `before`
  era substituído por `{resumo:'resposta extensa'}`, perdendo-se por inteiro.
- Testes: 7 novos em `balance.service.spec.ts` (load/deduct/reverse/transfer/extend/
  unarchive/notified) + 2 em `order` + 1 em `kitchen` + 1 em `public-screen` + 6 em
  `event` + 2 em `catalog` + 2 em `user` + 2 em `audit.interceptor.spec.ts` (override
  de `entityId` e snapshot de criação sem `antes`).

**Decisões**
- O **serviço** constrói o snapshot completo (tem todos os dados: antes + evento +
  extras); o **controller** só o arquiva no `req` — evita que os serviços de domínio
  dependam do `AuditService` (registo duplicado).
- `arquivarAuditoria(req)` é o único ponto que toca nos símbolos do `req`; os
  controllers não conhecem `definirAuditBefore`/`definirAuditEvento`/`definirAuditEntidade`
  directamente.
- Um mecanismo só para a auditoria: os registos directos do `AuditService` no
  `catalog` (ajuste de stock) e no `cash-closure` (fechar e abrir) foram removidos —
  deixavam **duas** entradas por operação. `catalog.module`/`cash-closure.module`
  perderam o `AuditModule` e os serviços o `AuditService`.

**Verificação em execução** (instância de teste em `:3100`, `NODE_ENV=test`, build
fresco; parada no fim): `PATCH /products/:id` → `before` de 306 chars com o produto
sem `event` aninhado; `PATCH /events/:id` → `before` de 415 chars com
`floorPlanVersion` mas **sem** a chave `floorPlan`; `entityId`/`eventId` correctos em
ambos. O arranque da app valida também a injecção de dependências após remover o
`AuditModule` dos dois módulos.

**Gates**: `tsc` 0 erros · vitest **438/438** · `lint` com os 4 avisos pré-existentes
(nenhum novo) · `build` OK (`nest build`).

**Pendente**: nenhum para a dívida #1. (Dívida nova: nenhuma.)

---

## 2026-10-19 — Versão-base da planta passa a ser por evento (dívida #12)

**Objectivo**: dívida #12, descoberta ao validar a #5 — `plantaVersionRef` era um
ref único, escrito só quando um GET resolvia. Ao trocar de evento e editar antes de
a resposta do novo evento chegar, o PUT levava a versão do evento anterior → **409**
e painel de conflito espúrio (sem perda de dados: a edição ficava em `pendente`).

**Feito**
- `plantaVersionRef` substituída por `plantaVersoesRef` (`Record<shortCode, number>`)
  e `plantaGravarAdiadoRef` (`Record<shortCode, true>`).
- `enviarPlantaContexto` deixa de receber `version`: lê-a do mapa por `shortCode`.
  Sem versão conhecida, a gravação é **adiada** (marca em `plantaGravarAdiadoRef`,
  mostra «A guardar…» se o evento estiver activo, retorna) em vez de enviar a versão
  errada. No sucesso, grava `r.version ?? version + 1` no mapa do evento.
- Efeito de carga: `plantaVersoesRef.current[plantaShortCode] = versaoServidor` e, se
  havia gravação adiada, limpa a marca e chama `agendarGuardarPlanta(...)` (debounce
  de 800 ms) com o estado actual.
- Flush de pendente cross-evento semeia o mapa com a versão guardada, condicional
  (`version?: number` no tipo de `plantaPendenteRef` — versão desconhecida é válida).
- Se o GET falhar (offline), a gravação adiada é registada como `pendente` para o
  aviso de outros eventos.
- `registarPendentePlanta(shortCode, mesas, zonas, version?)` centraliza a escrita da
  chave `sf:planta-pendente:*` (usada na falha de gravação e no caminho offline).
- Handlers de conflito escrevem o mapa (`recarregarPlantaRemota`/`forcarGuardarPlanta`
  = `conflito.version`; `descartarPlantaLocal` = 0).

**Verificação (browser, Playwright)**: cache local semeada com uma mesa e o GET do
evento retido à mão; arrasto antes da resposta (nenhum PUT, sem conflito); resposta do
servidor (v27) libertada → PUT imediato **com `version: 27` → 200**, indicador
«Guardado», sem painel de conflito. Antes da correcção este PUT levava a versão do
outro evento → 409.

**Incidente e recuperação**: a cache semeada tinha só 1 mesa e o PUT substituiu o
documento todo → as Mesas B e C do evento de teste desapareceram (Mesa A voltou com
id sintético). Restaurado **exactamente** a partir do `before` da auditoria
(`/api/audit/:id`, entrada PLANTA das 18:22:10): 3 mesas com ids originais, zonas e
dimensões intactas (v30). Confirma o valor prático do `before` (dívida #1).

**Gates**: `tsc` 0 erros · vitest **268/268** · `lint` limpo · `build` OK
(`Compiled successfully`). **Pendente**: repor após cada verificação que mexe no
documento inteiro; a auditoria já provou servir de rede.

**Commits**: (fix) `frontend: versão-base da planta por evento (dívida #12)`.

---

## 2026-10-19 — Flag de edições da planta passa a ser limpa (dívida #5)

**Objectivo**: dívida #5 — `plantaEditadaDesdeCargaRef` só era reposta a `false` no
início de cada carga; depois de uma gravação com sucesso continuava `true`, e
`decidirPlantaRemota` ignorava (`'ignorar'`) qualquer resposta remota subsequente.

**Feito**
- Novo `plantaEdicaoSeqRef` (contador) e helper `marcarPlantaEditada()`, que agora é
  a única forma de marcar edição (substituiu 4 atribuições directas).
- `enviarPlantaContexto` captura `seqDoEnvio` antes do `await` e, no sucesso, limpa
  a flag **só se não houve edições entretanto** (`plantaEdicaoSeqRef.current ===
  seqDoEnvio`) — evita que uma gravação antiga seja tomada como representativa do
  estado actual e deixe uma resposta remota atrasada sobrescrever edições novas.
- `esquecerEdicoesLocais()` em `recarregarPlantaRemota` (adoptar a versão do
  servidor) e em `descartarPlantaLocal`: nesses casos também deixou de haver edições
  locais por gravar; a sequência avança para uma gravação em voo não contar como
  actual.

**Verificação em browser real** (Playwright, `festa-teste-2026`): GET `/planta`
retido à mão e libertado só depois de a gravação (PUT 200, `v25`) ter sucesso —
com o `id`/`volta` por outro evento para que o GET retido fosse o da reaproximação.
A resposta injectada (Mesa A do servidor em 12,88) **foi aplicada**: mesa passou a
`12%,88%`, cache local reescrita, zero erros. Como a flag só podia estar `false`
pelo caminho novo (a carga e o arrasto marcaram-na `true`), isto prova a limpeza.
Na mesma sessão, com a resposta a chegar *antes* da gravação, o comportamento
mantém-se: a edição local não é sobrescrita (o `'ignorar'` protegido continua
coberto pelos testes de `decidirPlantaRemota`). Conteúdo do evento reposto
(Mesa A em 35,35).

**Observação nova** (registada como dívida #12 no `PLAN.md`): ao trocar de evento e
editar antes de o GET do evento novo resolver, o PUT leva a versão do evento
anterior → **409** e conflito espúrio (apareceu ao montar esta verificação).

**Gates**: frontend `tsc` limpo, **268/268**, lint sem warnings, build ok.

---


**Objectivo**: dívida #6 — o fundo translúcido da zona era obtido concatenando alfa
ao texto da cor.

**Feito**
- Localizado o sítio real: `admin/page.tsx:4215` fazia `` `${zona.cor}22` `` (a nota
  da dívida apontava para `renderSvgPlanta`, que já usava `fill-opacity="0.16"` e
  nunca teve o problema).
- Novo helper puro `fundoZona(cor, percentagem = 16)` em `lib/planta.ts` que devolve
  `color-mix(in srgb, <cor> <pct>%, transparent)`; a percentagem é limitada a 0-100
  (NaN cai no valor por omissão). `PERCENTAGEM_FUNDO_ZONA = 16` coincide com o
  `fill-opacity` do SVG, para o canvas e o PNG exportado ficarem iguais.
- `color-mix` aceita qualquer formato de cor (`#rgb`, `#rrggbb`, `#rrggbbaa`,
  `rgb()`, `hsl()`, nomes), ao contrário da concatenação, que só funcionava com hex
  de 6 dígitos (com `#08f` produzia `#08f22`, inválido, e o browser descartava a
  declaração — fundo transparente).

**Testes**: `describe('fundoZona')` com 3 casos (valor por omissão; cinco formatos de
cor equivalem-se; limites 0/100/NaN). Frontend **268/268**.

**Verificação em browser real** (Playwright, `festa-teste-2026` v22 → v23 → v24):
cor da Zona 1 trocada por `#08f` via API, `getComputedStyle` do `.planta-zona`
devolveu `color(srgb 0 0.533333 1 / 0.16)` (α = 0,16 ✓) e borda
`rgb(0, 136, 255)`; cor reposta em `#3b82f6` no fim. Zero erros de página.

**Gates**: frontend `tsc` limpo, 268/268, lint sem warnings, build ok
(`Compiled successfully in 7.8s`).

---

## 2026-10-19 — Binário nativo do SWC truncado (dívida #8)

**Objectivo**: dívida #8 — o binário `@next/swc-win32-x64-msvc` estava truncado e o
frontend caía no compilador alternativo, com avisos em cada build.

**Feito**
- Provado o defeito antes de mexer: `node`
  `require('.../next-swc.win32-x64-msvc.node')` falhava com *«is not a valid Win32
  application»*; tamanho instalado **18 449 860 B** contra **148 387 320 B**
  esperados (soma dos 3 ficheiros em `dist.unpackedSize` no registro). O magic `MZ`
  era normal (PE do Windows) — o sinal real era o tamanho.
- Correcção: `rm -rf node_modules/@next/swc-win32-x64-msvc` +
  `npm install --prefer-online` na raiz (monorepo com workspaces; o pacote está
  hoisted). `package-lock.json` não mudou (a versão já era a 15.5.24).
- Verificação: binário com **148 386 816 B** e a carregar **OK**.

**Medições (build frio, `.next` apagado)**
- Antes: 80 s, `Compiled successfully in 20.9 s` com avisos repetidos
  «⚠ Attempted to load @next/swc-win32-x64-msvc, but an error occurred…».
- Depois: 72 s, `Compiled successfully in 16.4 s`, **zero** ocorrências de
  `swc|wasm` no log do build.
- A diferença de tempo é modesta porque o Next 15 faz fallback para o compilador
  alternativo sem falhar o build — o ganho é sobretudo deixar de ter um binário
  inválido e avisos ruidosos.

**Gates**: frontend `tsc` limpo, **265/265**, lint sem warnings, build ok.
(`node_modules` é ignorado pelo git — a correcção é do ambiente, não do
repositório.)

---

## 2026-10-19 — `/health/ready` devolve 503 com dependência unhealthy (dívida #9)

**Objectivo**: dívida #9 — `/api/health/ready` respondia **200** mesmo com
`status: "unhealthy"`, enganando readiness probes (o load balancer mantinha tráfego
a uma instância incapaz de servir).

**Feito**
- `ready()` passa a definir o código HTTP: **503** quando a base de dados falha ou
  o Redis está configurado e não está `ready`; 200 nos restantes casos. O corpo
  mantém `status`/`timestamp`/`dependencies`.
- `dependencies.redis` ganha o estado explícito **`disabled`** quando
  `REDIS_URL` não está definido — a app funciona em degradação segura sem Redis
  (`RedisService.isEnabled`), por isso a ausência não pode ser lida como falha.
  Antes reportava `unhealthy` e mantinha 200 (contraditório).
- `@Res({ passthrough: true })` para fixar o status sem interferir no corpo (evita
  entregar a decisão ao filtro global de excepções).
- 8 testes novos em `health.controller.spec.ts` (200 com Redis desativado/pronto,
  503 com Redis em `connecting`, 503 com BD em baixo mesmo com Redis pronto,
  `disabled` no corpo, timestamp ISO, `live` sem tocar em dependências, `check`).
  O teste e2e da rota passa a verificar o **contrato** (503 ⇔ alguma dependência
  `unhealthy`) em vez de esperar 200 cego, já que o ambiente e2e pode não ter Redis.

**Decisões**
- Redis **ausente** ≠ Redis **em baixo**: só o segundo derruba a readiness. Assim o
  deploy sem Redis (Vercel) não é retirado de rotação, mas uma falha real de Redis
  é visível para as probes.
- Correlação status↔corpo testada no e2e para o teste continuar válido com ou sem
  Redis a correr localmente.

**Commit**: `12e6d35 fix(health): /health/ready devolve 503 com dependencia unhealthy`

**Gates**: backend `tsc` limpo, **412/412** (404 + 8), build ok, lint 4 warnings
pré-existentes.

**Verificação (execução real)**: duas instâncias do build em portas 3010/3011
(NODE_ENV=test, sem seeders), usando a BD real:
- sem `REDIS_URL` → `{"status":"ready",...,"redis":"disabled"}` **HTTP 200**;
- `REDIS_URL=redis://127.0.0.1:6399` (inacessível) →
  `{"status":"unhealthy","database":"healthy","redis":"unhealthy"}` **HTTP 503**;
- `/api/health` continua **200** (não depende de dependências) e `/api/health/live`
  **200**.\
Nota: a instância de desenvolvimento em `:3000` (PID do utilizador) continua com o
código antigo até ser reiniciada.

---

## 2026-10-19 — Aviso de pendentes derivado do armazenamento + idade do conflito viva (dívidas #3 e #4)

**Objectivo**: dívida #3 — o `plantaAviso` (edição de um evento anterior ficou por
sincronizar) era limpo no arranque de cada carga e nunca sobrevivia a um reload;
dívida #4 — a idade do pendente no painel de conflito ficava congelada no render.

**Feito**
- **#3**: substituído o estado `plantaAviso` por `plantaPendentesOutros`, derivado
  do armazenamento com `pendentesDeOutrosEventos(chaves, shortCodeAtual)` (novo
  helper puro em `lib/planta.ts`). Como a chave `sf:planta-pendente:*` só existe
  depois de uma falha de gravação (é removida em cada sucesso), a lista é sempre
  verdadeira; recalcula-se na carga do evento, após limpeza de órfãos e após cada
  tentativa de gravação (sucesso ou falha). O banner lista os eventos pelo nome e
  cada um tem botão **«Ir para <evento>»** que muda o evento — a carga desse evento
  oferece ou reenvia o pendente. Removido o botão «Fechar» (o aviso resolve-se ao
  reconciliar, não se dispensa).
- **#4**: `agoraIdade` (estado) + intervalo de 30 s **activo só enquanto o painel
  de conflito estiver aberto**; `descreverIdade(ts, agora)` passa a receber o
  instante actual, pelo que a idade acompanha o tempo real.
- 3 testes novos para `pendentesDeOutrosEventos` (com/sem pendente de outro evento,
  ordenação, chaves sem shortCode).

**Decisões**
- Derivar o aviso do `localStorage` em vez de o guardar em estado: um aviso
  transiente perde-se em reload/re-render e não é verificável; derivado, o estado
  é o próprio armazenamento (uma única fonte de verdade).
- Sem botão de dispensar: o pendente continua por sincronizar, logo esconder o
  aviso seria mentir ao utilizador. O caminho é reconciliar.
- Intervalo só com o painel aberto (não um tick global): nada corre quando não é
  preciso.

**Commit**: `fix(planta): aviso de pendentes derivado do armazenamento e idade do conflito viva` (feature + testes)

**Gates**: frontend `tsc` limpo, **265/265** (262 + 3), build ok, lint sem warnings.

**Verificação (browser, Chrome real)**
- #3: com os PUT da planta bloqueados, editar o Magusto deixa
  `sf:planta-pendente:magusto`; ao mudar para o outro evento aparece
  «Edições por sincronizar noutros eventos: Magusto. Abre o evento para reconciliar.»
  com botão «Ir para Magusto»; **sobrevive a F5**; depois de desbloquear e clicar
  no botão, o evento é reconciliado (servidor recebe a mesa), o banner desaparece e
  a chave pendente é removida. Screenshots `pendentes-1-outro-evento.png`,
  `pendentes-2-reload.png`, `pendentes-3-reconciliado.png`.
- #4: com o painel de conflito aberto (edição pendente + planta alterada «noutro
  dispositivo»), a idade vai de «(há instantes)» para «(há 2 min)» com avanço do
  relógio da página; «Recarregar» fecha o painel e remove o pendente. Screenshots
  `conflito-idade-0.png`, `conflito-idade-2min.png`.
- Sem `pageerror`; documento do Magusto reposto no fim (conteúdo original). O
  browser com relógio virtual precisa de `clock.fastForward` para o debounce de
  800 ms disparar.

---

## 2026-10-19 — Rótulos acessíveis sem prefixo duplicado (dívida #11)

**Objectivo**: leitores de ecrã ouviam «Mesa Mesa A, 8 lugares» / «Zona Zona 1» no
editor de planta, porque o nome já inclui o prefixo.

**Feito**
- `rotuloAcessivel(prefixo, nome)` em `lib/planta.ts`: devolve o nome tal como está
  quando começa já pelo prefixo **como palavra inteira** (`mesa ` / igual), senão
  prefixa; nome vazio devolve só o prefixo; comparação sem maiúsculas nem espaços
  nas pontas. «Mesalina» continua a receber o prefixo.
- `admin/page.tsx`: `aria-label` da mesa e da zona passam a usar o helper (o da
  mesa mantém lugares e o ângulo).
- 5 testes novos (nome-com-prefixo, sem-prefixo, maiúsculas/espaços, vazio,
  quase-prefixo).

**Decisões**
- Lógica no helper testável em vez de condicional no JSX (regra do projecto:
  lógica não-UI fora do componente).
- Prefixo exigido como palavra inteira para não deixar nomes como «Mesalina» sem
  contexto; um `startsWith` simples teria esse defeito.

**Commit**: `fix(a11y): rotulo acessivel sem prefixo duplicado` (feature + docs)

**Gates**: frontend `tsc` limpo, **262/262** (257 + 5), build ok, lint sem warnings.

**Verificação (browser)**: Chrome real em `festa-teste-2026` — `aria-label` agora
`"Mesa A, 8 lugares"`, `"Mesa B, 8 lugares"`, `"Mesa C, 8 lugares"`, `"Zona 1"`,
sem erros de página.

---

## 2026-10-19 — Rotação de mesas (graus)

**Objectivo**: roadmap prioridade baixa #9 — mesas não alinhadas com a grelha.

**Feito**
- **Backend**: `MesaPlantaDto.rotacao` opcional (`@IsInt`, `@Min(0)`, `@Max(359)`).
  Plantas antigas não o têm e assume-se 0; o serviço grava as mesas como vêm (sem
  normalização por mesa), por isso basta o DTO.
- **lib**: `Mesa.rotacao` obrigatório (default 0 em `criarMesa`), `normalizarRotacao`
  (redonda e em módulo 360, aceita negativos), `PASSO_ROTACAO = 45`; `parsePlanta`
  lê e normaliza; `renderSvgPlanta` envolve **só a forma** em
  `<g transform="rotate(a x cy)">` — o rótulo fica direito.
- **admin**: a mesa passou a ter um `<span aria-hidden>` com a forma (bg/borda) que
  roda, com o nome/lugares por cima **sem** rodar. Para o ângulo ser visível no
  canvas, a mesa quadrada desenha 85% da altura (igual ao rectângulo 1:0.85 do
  SVG); a redonda é invariante. Controlos: input 0–359 (passo 45) e botões −45/+45;
  atalhos `r` (roda) e `Shift+R` (roda ao contrário); duplicar copia o ângulo.
- Bug corrigido durante a verificação: o `preventDefault` do `pointerdown` impedia
  o foco, logo os atalhos de teclado (setas, `Delete`, `r`) só funcionavam depois
  de `Tab`. O clique passa a dar foco explícito (`focus({preventScroll:true})`).
- Testes: 6 do DTO no backend (compatibilidade, limites, decimais, não numérico);
  6 na lib (normalização, `criarMesa`, `parsePlanta`, `moverMesa` preserva,
  SVG roda só a forma, sem rotação não emite `<g>`).

**Decisões**
- Graus inteiros 0–359 no próprio documento da mesa; **não** se guarda a matriz de
  transformação nem se usam radianos (export legível, JSON estável).
- Rodar a forma e não o rótulo: um plano com nomes inclinados é ilegível.
- A mesa quadrada passou a ser um rectângulo 1:0.85 também no canvas — antes era
  um quadrado, divergindo do SVG; agora canvas e export coincidem.
- `rotacao` fica no payload dos clientes novos; um cliente antigo que não o envie
  grava mesas sem `rotacao` (tolerado no parse, que assume 0).

**Commits**
- `0588f4a feat(planta): rotacao da mesa no DTO (0-359 graus, opcional)`
- `934e12a feat(planta): rotacao de mesas (0-359 graus)`
- `docs: registar rotacao de mesas` (PLAN.md + este)

**Gates**: backend `tsc` limpo, **404/404** (398 + 6), build ok, lint 4 warnings
pré-existentes; frontend `tsc` limpo, **257/257** (251 + 6), build ok, lint sem
warnings.

**Verificação (browser)**
- Playwright + Chrome real em `festa-teste-2026`: Mesa A → quadrada + 45°: bbox da
  forma passa de **76×64,6** (rectângulo) para **99,4×99,4** (losango) — a rotação
  é mesmo aplicada no canvas; `style="... rotate(45deg)"`; rótulo com
  `transform: none` (direito); `aria-label` ganha «rodada 45 graus».
- Botões ±45°: 45 → 90 → 45. Teclado: Mesa B `r` → 45°, `Shift+R` → 0°.
- Sem `pageerror` nem `console.error`.
- Estado do evento reposto no fim (3 mesas redondas `rotacao: 0`, 1 zona, 25×15 m)
  via API; screenshots `rotacao-mesa-45.png` e `rotacao-mesa-final.png`.
- Nota: a 1.ª corrida do script falhou por assumir o baseline limpo (a corrida
  anterior tinha deixado a Mesa A quadrada/45) — os testes de UI que dependem de
  mudança de estado precisam de repor o baseline primeiro.

**Pendente**: push dos commits locais — só com autorização explícita. O rótulo
acessível duplicado («Mesa Mesa A», «Zona Zona 1») ficou registado como dívida #11.

---

## 2026-10-19 — Dimensões reais da planta (metros) e export à escala

**Objectivo**: roadmap prioridade baixa #10 — dimensões reais em metros para
impressão à escala.

**Feito**
- **Backend**: `DimensoesPlantaDto` (`larguraM`/`alturaM`, `@IsNumber({maxDecimalPlaces:1})`,
  `@Min(1)`, `@Max(200)`) opcional em `GuardarPlantaDto`; `normalizarDimensoes`
  (clamp 1–200, arredonda a 0.1, `null` se inválido); `lerFloorPlan` devolve
  `dimensoes`; `obterPlanta`/409/callback só a incluem quando existem (mantém os
  `toEqual` antigos verdes); `guardarPlanta` faz merge
  `dto.dimensoes ? normalizar : atual.dimensoes` — **preserva** as dimensões
  quando o payload as omite.
- **Frontend**: `Dimensoes` no `DocumentoPlanta` + `normalizarDimensoes`,
  `proporcaoPlanta` (fallback 16/9), `dimensoesExport` (100 px/m, cap 6000 px por
  lado), `formatarMetros` (vírgula, 1 decimal); `parseDocumentoPlanta` lê
  dimensões; `renderSvgPlanta` usa `viewBox "0 0 100 H"` com `H = 100·alturaM/larguraM`
  (unidades isotrópicas: círculos continuam círculos) e desenha barra de escala
  (`larguraM/4`) + legenda `larguraM × alturaM`; `admin/page.tsx` com inputs
  Largura/Altura (guardar em `onBlur`/Enter), canvas com a proporção real e export
  com `larguraPx/alturaPx` do helper; dimensões viajam no save pendente/offline e
  no caminho de conflito.
- Testes: 8 novos no backend (4 DTO + 4 serviço: obter, gravar, preservar,
  409 com dimensões); 13 novos no frontend (helpers, parsing, SVG com/sem
  dimensões e barra de escala).

**Decisões**
- Dimensões dentro do documento da planta (não em `settings`): viajam com
  import/export local e com o 409, e mantêm-se coerentes com as mesas.
- Serviço preserva quando omitidas — evita que arrastar uma mesa (payload sem
  dimensões) as apague e mantém compatibilidade com clientes antigos.
- Ao sair de um campo de dimensão sem o par completo, repõe-se **só o campo
  inválido** (o outro mantém-se para o utilizador completar o par). Descoberto na
  verificação: a primeira versão repunha ambos e tornava impossível preencher os
  dois campos por tabulação.
- Barra de escala com 25% da largura (= `larguraM/4`) para caber em qualquer
  proporção; sem dimensões o export mantém-se quadrado a 1600 px.

**Commits**
- `8faebf7 feat(planta): dimensoes reais em metros no documento da planta`
- `c1d78f6 feat(planta): dimensoes reais em metros com export a escala`
- `docs: registar dimensoes reais e export a escala` (PLAN.md + este)

**Gates**: backend `tsc` limpo, **398/398** (390 + 8), build ok, lint 4 warnings
pré-existentes (o de `event.service` mudou da linha 365 para 385); frontend `tsc`
limpo, **251/251** (238 + 13), build ok, lint sem warnings.

**Verificação (browser)**
- Playwright + Chrome real contra `festa-teste-2026`: 25×15 → `PUT ... /planta`
  200; canvas `aspect-ratio: 1.66667 / 1`; export PNG lido no IHDR = **2500×1500**
  (100 px/m); após reload inputs 25/15; sem `pageerror` nem `console.error` (401
  pré-login do refresh ignorado).
- Preservação confirmada por API: `PUT` com `{mesas:[], zonas:[], version}` (sem
  `dimensoes`) devolveu as dimensões guardadas intactas (`25×15`).
- Screenshots: `planta-dimensoes-ui.png` e `planta-dimensoes.png` em
  `C:\Users\smpsa\AppData\Local\Temp\opencode\shots`.

**Incidente e recuperação**
- O teste de preservação acima enviou `mesas: []`, **apagando as 3 mesas** do
  evento de teste. Recuperadas a partir da auditoria (`GET /api/audit/:id`, campo
  `after` do último `PLANTA`, versão 5) e restauradas via `PUT`: 3 mesas (Mesa
  A/B/C) + Zona 1 + `25×15` (versão final 7). Sem perda de dados.
- Lição: nos testes por API, reenviar sempre o documento lido — nunca um payload
  mínimo — e verificar a auditoria antes de escrever.

**Pendente**: push dos commits locais — só com autorização explícita. A lógica de
`guardarDimensoesPlanta` (repõe o campo inválido) vive no componente e não tem
teste unitário; coberta só pela verificação no browser.

---

## 2026-10-19 — Aviso de sobreposição de zonas + limite 100

**Objectivo**: roadmap prioridade média #6 e #7.

**Feito**
- `planta.ts`: `paresDeSobreposicao(zonas, limiar = 0.2)` devolve pares com a
  fracção da **menor** zona coberta; encostar (interseccção 0) e sobreposições
  abaixo de 20% não contam.
- `admin/page.tsx`: `useMemo` com nomes dos pares; aviso `text-amber-400` sob a
  planta (mesmo padrão do aviso de nomes duplicados). Só avisa — não bloqueia.
- `MAX_ZONAS_PLANTA` 50 → 100: constante exportada no `planta.dto.ts`
  (`@ArrayMaxSize`) e usada no `slice` do serviço; frontend já a importava da
  lib. Teste do DTO passou a rejeitar 101.
- Testes: 6 novos em `planta.test.ts` (separadas, encostadas, 15% abaixo do
  limiar, 25% detectada, contida dá fracção 1, limiar personalizado).

**Decisões**
- Limiar sobre a menor zona (não sobre a união): é o que distingue "toca ao
  arrastar" de "uma zona cobre metade da outra".
- Sem validação no backend: sobreposição pode ser intencional; 400 impediria
  layouts legítimos.

**Commits**
- `933c2b3 feat(backend): aumentar o limite de zonas da planta para 100`
- `de17636 feat(frontend): avisar sobre sobreposicao significativa de zonas`
- `docs: registar o aviso de zonas e o limite de 100` (PLAN.md + este)

**Gates**: backend `tsc` limpo, 390/390, build ok, lint 4 warnings pré-existentes;
frontend `tsc` limpo, **238/238**, build ok, lint sem warnings.

**Verificação (browser)**
- Playwright + Chrome real contra `festa-teste-2026`: 1 zona antes; "Adicionar
  zona" 2× → 3 zonas e aviso `Zonas sobrepostas: Zona 1 × Zona 2; Zona 1 ×
  Zona 3; Zona 2 × Zona 3. Confirma se é intencional.`
- Sem `pageerror` nem `console.error` (401 pré-login do refresh ignorado).
- Screenshot: `C:\Users\smpsa\AppData\Local\Temp\opencode\shots\zonas-sobrepostas.png`
- **Sem artefactos no servidor**: as zonas novas só existiram em estado local —
  GET da planta e auditoria confirmam `version: 4` e última escrita `PLANTA` às
  13:21 (antes do teste). Nada a limpar no evento.

**Pendente**: push dos commits locais — só com autorização explícita.

---

## 2026-10-19 — Auditoria com `before` no PUT da planta

**Objectivo**: roadmap prioridade média #4 (dívida #1) — o `AuditInterceptor`
grava só `after`; nos PUT da planta não se sabe o que mudou.

**Feito**
- `audit.interceptor.ts`: exporta `AUDIT_BEFORE` (símbolo) e
  `definirAuditBefore(req, antes)`; no branch de sucesso lê `req[AUDIT_BEFORE]`
  e passa `before: resumoResposta(...)` — mesmo corte de >8000 chars do `after`.
- `event.service.ts.guardarPlanta`: 4º parâmetro opcional
  `antesDeGravar?(anterior)` invocado **depois** da checagem de `version` (não
  corre em 409/404) com `{ mesas, zonas, version }` do `lerFloorPlan`.
- `event.controller.ts`: passa callback que arquiva o snapshot no `req`.
- Testes: 3 no spec do serviço (callback com estado anterior; não corre em 409;
  não corre em 404) + novo `audit.interceptor.spec.ts` (grava `before`+`after`,
  `before` ausente mantém comportamento antigo, resumo corta resposta extensa).

**Decisões**
- **Callback em vez de `@Inject(REQUEST)`/AsyncLocalStorage/símbolo na
  resposta**: o serviço não tem acesso ao `req`; o controller (que já tinha
  `@Request() req: any`) faz o stash. Evita mudar lifetimes DI, `enterWith`
  frágil ou segundas leituras na BD.
- Chave `Symbol` em vez de propriedade string: não aparece em `JSON.stringify`
  nem em logs do pedido.
- `record()` directo (padrão `catalog.service`) **não** usado aqui — duplicaria
  o registo do interceptor para esta rota.
- Só o branch de sucesso grava `before`: em 409/404 o serviço nem chega a
  invocar o callback, logo não há estado anterior para guardar.

**Commits**
- `e9347fa feat(backend): auditar o estado anterior no PUT da planta`
- `docs: registar o before/after no PUT da planta` (PLAN.md + este)

**Gates (backend)**: `tsc` limpo; `vitest` **390/390**; `build` ok; `lint` só os
4 warnings pré-existentes (nenhum novo).

**Pendente**: push dos commits locais — só com autorização explícita.

---

## 2026-10-19 — Feedback visual no export PNG

**Objectivo**: roadmap prioridade alta #3 (dívida #7) — o export era silencioso:
se `Image.onload` falhasse (ou `getContext`/`toBlob` devolvesse nulo), o botão
não fazia nada.

**Feito**
- Novo estado dedicado `exportarEstado` (`'' | 'a-exportar' | 'erro'`) — não
  sobrecarrega `plantaSync`, que continua a significar "sincronização com o
  servidor".
- `exportarPlantaPng` reescrito como `async` com `Promise`: `img.onerror`,
  `getContext('2d')` nulo e `toBlob` nulo passam a cair num `try/catch` real.
  `URL.revokeObjectURL` do SVG fica num `finally`.
- Botão "Exportar PNG" desactivado durante o export; aviso `A exportar…` e erro
  `Falha ao exportar a PNG — tenta de novo` na linha de estado.

**Verificação (browser, Playwright + Chrome real)**
- Sucesso: download `planta-festa-teste-2026.png` com a nova implementação.
- Erro: `Image.onerror` forçado → mensagem visível. `PAGE_ERRORS: 0`.

**Commits**
- `05d8536 feat(frontend): feedback visual no export PNG da planta`
- `docs: registar o feedback do export PNG` (PLAN.md + este)

**Gates (frontend)**: `tsc` limpo; `vitest` 232/232; `lint` sem warnings;
`build` OK.

---

## 2026-10-19 — Undo para zonas da planta

**Objectivo**: roadmap prioridade alta #2 (dívida #2) — apagar uma zona era
irreversível; o snapshot `{mesas, zonas}` já existia mas só as operações de mesa
(o `auto-organizar` e o `limpar`) ofereciam undo.

**Feito**
- `adicionarZonaPlanta`, `removerZonaPlanta` e `editarZonaPlanta` tiram o
  snapshot **antes** de alterar e chamam `oferecerUndo` **depois**
  (`definirDocumento` limpa o undo, como já faziam as restantes operações).
- Labels: `Zona adicionada` / `Zona removida` / `Zona editada` — o banner e o
  botão "Desfazer" já eram genéricos, sem mudança de UI.

**Notas**
- Editar o nome a teclar oferece undo por tecla (desfaz a última alteração);
  limitação da arquitectura actual (limpa-oferece), documentada no `PLAN.md`.

**Commits**
- `c6a61c0 feat(frontend): undo para as operacoes de zona da planta`
- `docs: registar o undo das zonas da planta` (PLAN.md + este)

**Gates (frontend)**: `tsc` limpo; `vitest` 232/232; `lint` sem warnings;
`build` OK.

---

## 2026-10-19 — Fluxo de pendente da planta: testes do efeito

**Objectivo**: roadmap prioridade alta #1 — testar o **efeito** que chama
`decidirPlantaRemota` (antes só havia testes da decisão em si).

**Feito**
- Novo helper puro `resolverPlanoCargaPlanta` (`frontend/src/lib/planta.ts`):
  entrada `{editadoDesdeCarga, pendente, remoto, local}` → plano discriminado
  (`aplicar` / `ignorar` / `oferecer-importacao` / `conflito-pendente` /
  `retomar-pendente`) com o payload completo (mesas, zonas, `version`,
  `pendenteTs`).
- O efeito de carga em `admin/page.tsx` deixou de decidir: só **aplica** o plano
  (refs, estado, `localStorage`). Semântica preservada ramo a ramo — incluindo que
  `retomar` reenvia as **locais** com a **versão do servidor** e que `conflito`
  mostra as **remotas** com o `pendenteTs`.
- 5 novos testes em `planta.test.ts` cobrem os 5 ramos + zonas pendentes no
  retomar.

**Decisão**: sem teste RTL da página (4254 linhas, dependências de auth/eventos) —
o projecto segue a convenção de helpers puros testáveis; o efeito ficou com
mapeamento mecânico.

**Commits**
- `840b171 refactor(frontend): extrair o plano de carga da planta para helper puro testado`
- `docs: registar os testes do fluxo de pendente da planta` (PLAN.md + este)

**Gates (frontend)**: `tsc` limpo; `vitest` **232/232** (antes 227); `lint` sem
warnings; `build` OK.

**Pendente**: restart do opencode para validar o MCP `cdt`.

---

## 2026-10-19 — Correcção CSP em dev (hidratação)

**Objectivo**: resolver a dívida #10 do `PLAN.md` — o frontend em `npm run dev`
ficava inerte porque a CSP bloqueava o `eval` do webpack e o React não hidratava.

**Feito**
- `next.config.js`: `script-src` passa a incluir `'unsafe-eval'` **só quando
  `!isProd`**; produção mantém `'self' 'unsafe-inline'` (estrito).
- Verificação end-to-end: backend (`:3000`) + frontend dev (`:3001`); Playwright
  **sem `bypassCSP`** → `HIDRATADO: true`, sem erro de CSP/eval. (1 erro benigno:
  `401` pré-login em `/api/auth/refresh`.)
- Headers confirmados por `curl` nos dois modos: **dev** `script-src 'self'
  'unsafe-inline' 'unsafe-eval'`; **prod** (`next start`) `script-src 'self'
  'unsafe-inline'` — produção fica estrita, como pretendido.

**Gates (frontend)**
- `tsc --noEmit` limpo; `vitest run` 227/227; `lint` sem warnings; `build` OK.

**Commits**
- `frontend/next.config.js` (fix) + `PLAN.md`/`PROGRESS.md` (docs)

**Pendente**
- Restart do opencode para validar o próprio MCP `cdt`.

---

## 2026-10-19 — Teste visual (Playwright)

**Objectivo**: validar visualmente o editor da planta sem o MCP `cdt` (que só
carrega com restart do opencode), usando Playwright (já instalado para e2e).

**Feito**
- Login automático → `/admin` → tab Planta → evento `festa-teste-2026`.
- Criadas 3 mesas e 1 zona; arrastada Mesa A para dentro da zona.
- Auto-organizar por zonas; export PNG capturado como download real.
- Verificação programática na BD: `floorPlanVersion` subiu a 4; Mesa A dentro da
  Zona 1 (pertença derivada correcta); Mesas B/C sem zona → faixa no topo (y=6);
  export = PNG válido 1600×1600 (98.996 bytes).

**Descoberta (registada no `PLAN.md`, dívida #10)**
- A **CSP bloqueia a hidratação em dev**: `script-src 'self' 'unsafe-inline'` sem
  `'unsafe-eval'`, mas o webpack em dev usa `eval-source-map` → bundle bloqueado →
  React não hidrata → frontend inerte em qualquer browser em `npm run dev`. O teste
  usou `bypassCSP: true`. Produção (sem eval) não é afectada.

**Decisões tomadas**
- Validar via Playwright em vez de esperar pelo `cdt` — mesmo objectivo, ferramenta
  já disponível. O `cdt` continua por validar em si.
- Teste poluiu `festa-teste-2026` (aceite): 3 mesas + 1 zona, versão 4.

**Commits**
- (este) `docs: registar resultado do teste visual da planta`

**Gates**
- Só docs; sem alterações ao código da app.

**Pendente**
- Decidir se a CSP em dev deve permitir `unsafe-eval` (só em desenvolvimento).
- Restart do opencode para validar o próprio `cdt`.

---

## 2026-10-19 — Verificação de arranque + descobertas de ambiente

**Objectivo**: verificar se a app arranca contra a BD real e apurar riscos antes
do teste visual da planta (MCP `cdt`).

**Feito (tudo read-only)**
- Backend arranca: `Nest application successfully started`, `/api/health` → 200,
  `/api/health/ready` → 200, `/api/docs` → 200.
- Frontend arranca na 3001; `/auth/login` → 200; `/` e `/admin` → 307 →
  `/auth/login?from=…` → 200.
- DB: Postgres remoto (Neon, us-east-2); migração `FloorPlanZonas1790500000000`
  aplicada; conta `BOOTSTRAP_ADMIN_EMAIL` existe (35 utilizadores).
- Arranque **não mutou dados**: `AUDIT_SYSTEM_2H=0`, `AUDIT_QUALQUER_2H=0`; único
  `@Cron` corre às 3AM (`cleanupExpiredTokens`).

**Descobertas (registadas no `PLAN.md`)**
- **SWC do frontend truncado**: 18,4 MB instalados vs 148,4 MB esperados
  (`dist.unpackedSize`); cai para WASM. Corrigir reinstalando
  `@next/swc-win32-x64-msvc@15.5.24`.
- **Cron `cleanupExpiredTokens` não corre em produção**: 322 refresh tokens
  expirados há >1 dia, 187 revogados há >30 dias. Suspeita: serverless sem
  processo persistente.
- **`/health/ready` devolve 200 com Redis unhealthy** (corpo diz `"unhealthy"`):
  bug de contrato, devia ser 503.
- **Realtime funciona sem Redis** numa só instância (emissão local directa).

**Decisões tomadas**
- Não corrigir o `/ready` nem o cron nesta sessão — primeiro decidir o alvo do
  teste visual (o teste escreve `floorPlan` na Neon partilhada).
- Reinstalar o SWC **depois** do teste visual (não misturar variáveis).

**Commits**
- (este) `docs: registar descobertas da verificacao de arranque`

**Gates**
- Só docs; sem alterações ao código da app. BD apenas com `SELECT`.

**Decisões (2026-10-19, após revisão)**
- `/health/ready` a devolver 200 com dependência unhealthy: **não corrigir agora**
  — fica como dívida técnica (row 9 do `PLAN.md`).
- Teste visual da planta: **aceite polir evento existente**, usando o evento
  `festa-teste-2026` (é claramente de teste; único par viável com `magusto`).
- Reinstalar `@next/swc-win32-x64-msvc`: **depois** do teste visual.
- `d1ee9f4` fica local, sem push.

**Pendente**
- Teste visual da planta via `cdt` — requer restart do opencode (MCP só carrega no
  arranque) + backend/frontend a correr + login admin manual na janela do Chrome.
- Reinstalar `@next/swc-win32-x64-msvc@15.5.24` (ficheiro truncado).
- Confirmar se o cron corre em produção; se não, mover para cron externo (`/api/cron/*`).

---

## 2026-10-14 — Planta: zonas + export

**Objectivo**: zonas da sala com pertença de mesas + exportar planta como
imagem, em 4 commits.

**Feito**
- Backend: `floorPlan` passa de array para documento `{ mesas, zonas }`;
  `ZonaPlantaDto`; migração `1790500000000-FloorPlanZonas`; leitura defensiva do
  formato antigo; 409 devolve zonas.
- Frontend puro: helpers de zonas (`criarZona`, `moverZona`, `redimensionarZona`,
  `zonaContemPonto`, `zonaPrincipal`, `agruparMesasPorZona`), `parseDocumentoPlanta`,
  `reorganizarMesasComZonas`, `renderSvgPlanta` + `escaparXml`.
- UI: criar/mover/redimensionar/renomear/colorir zonas; pertença derivada;
  pendente/localStorage/409 transportam o documento.
- Export PNG, auto-organizar por zonas, QRs "Agrupar por: zona".

**Decisões tomadas**
- `w=0`/`h=0` rejeitados no DTO (`@Min(1)`) — zonas degeneradas não têm área.
- Mesas sem zona no auto-organizar → faixa no topo (altura ≤ 40%).
- `PlantaPendente` estendido para incluir `zonas` — sem isto, edições de zona
  perder-se-iam num 409/offline.

**Commits**
- `42b0574` feat(planta): guardar zonas no documento da planta
- `539dd67` feat(planta): helpers puros de zonas, documento e export SVG
- `922db4c` feat(planta): UI para desenhar zonas do salao
- `a14de17` feat(planta): exportar PNG, auto-organizar por zonas e QRs por zona

**Gates**
- Backend: tsc limpo, 384 testes, build ok, lint só com warnings pré-existentes.
- Frontend: tsc limpo, 227 testes, build ok, lint 0.

**Pendente**
- Verificar drag em tablet (sem browser nesta sessão).
- Undo para zonas.
- Testes de integração do fluxo de pendente.

---

## 2026-10-14 — Planta: sincronização com o servidor

**Objectivo**: persistir a planta no backend com optimistic locking e resolver conflitos.

**Feito**
- Backend: `floorPlan` jsonb + `floorPlanVersion`; `GET/PUT /events/:id/planta` (MANAGEMENT_ROLES); 409 com `{message, mesas, version}`; filtro propaga extras; CORS com `PUT`.
- Frontend: `ApiError.body`; `getPlanta`/`guardarPlanta`; carrega da API com fallback localStorage; grava com debounce 800ms; banner 409; importação local.
- Isolamento por evento, guard pós-await, deps `[plantaEventoId, plantaShortCode]`, flush de save pendente.
- Corrida de carga fechada (`plantaEditadaDesdeCargaRef`).
- Pendente por evento: `sf:planta-pendente:<shortCode>` com `{mesas, version, ts}`.
- Distinção rede vs conflito real: `retomar-pendente` vs `conflito-pendente`.
- Idade do pendente no banner; limpeza de órfãos.

**Decisões tomadas**
- Opção A (coluna jsonb) em vez de tabela relacional.
- Nomes duplicados → aviso + descarte.
- Conflitos → 409 + reconciliação.
- Permissões → organizer/superadmin.

**Commits**
- `9de8847` fix(planta): limpar undo ao trocar de evento e travar gravação cruzada
- `964713c` feat(planta): persistir planta de mesas no evento (jsonb + optimistic locking)
- `0b0b0a5` feat(planta): sincronizar planta com o servidor (debounce, 409 e importacao local)
- `6003713` fix(planta): isolar sincronizacao por evento (guard pos-await, deps por shortCode, flush de save pendente)
- `9c118a8` fix(planta): fechar corrida de carga e sinalizar edicao de evento anterior nao gravada
- `7852618` fix(planta): persistir edicao por sincronizar por evento
- `7b01d11` fix(planta): timestamp no pendente, idade no aviso e limpeza de orfaos
- `50a873b` fix(planta): distinguir conflito real de falha de rede no pendente

**Gates**
- Backend: 374 testes (na altura).
- Frontend: 187 testes (na altura).

---

## 2026-10-13 — Planta: drag & drop

**Objectivo**: editor visual de disposição das mesas.

**Feito**
- `lib/planta.ts` com helpers de geometria.
- Tab "Planta" no `/admin`: Pointer Events, percentagens, teclado.
- Auto-organizar, undo.

**Decisões tomadas**
- Posições em percentagem (0–100).
- `plantaEstadoRef` como fonte síncrona.
- Undo com snapshot em `useRef` + timer.

**Commits**
- `e4736c8` feat(planta): helpers de geometria das mesas
- `5fe982b` feat(admin): editor de planta das mesas com drag e drop
- `c3db319` fix(admin): gravar posicao no drag, imprimir a partir da planta

---

## 2026-10-13 — Lugares por mesa + QRs em lote

**Objectivo**: gerador de QRs por mesa em lote e lugares por mesa.

**Feito**
- Helpers para lotes/lugares; impressão A4 paginada; "aplicar a todas".
- Persistência localStorage.

**Decisões tomadas**
- Nomes de mesa codificados no URL.
- Intervalos só com inteiros válidos.

**Commits**
- `7c46b70` feat(mesa-qr): helper de lotes de mesas
- `a93c9f9` feat(admin): gerador de QRs por mesa em lote
- `f65c2b5` feat(qr-lote): helpers de lugares por mesa
- `a04bb8a` feat(admin): lugares por mesa no gerador de QRs

---

---

## 2026-10-11 — Melhorias #1–#10 + dropdown

**Objectivo**: entregar o conjunto de melhorias de UX/operação (#1 a #10).

**Feito**
- Backend #1/#3/#6/#8 + auditoria.
- POS #4/#5/#7, caixa #8, cozinha (stock baixo + rejeitar), dropdown qr-order.
- `color-scheme: dark`, popup de `<select>` em dark.

**Decisões tomadas**
- Helper `reporStockEmTransacao` partilhado entre `order.service` e `kitchen.service`.
- Transferência de saldo: `CANCEL` na origem, `LOAD` no destino, numa transação.
- `color-scheme: dark` global em `globals.css`.

**Commits**
- `7179aea` refactor(backend): helper partilhado reporStockEmTransacao
- `e305d64` feat(catalog): ajuste manual de stock com registo de auditoria
- `97e213d` feat(balance): transferencia de saldo entre eventos + auditoria
- `eb7bb78` feat(frontend): helpers de ajuste de stock e transferencia de saldo
- `be66e90` feat(admin): reabastecer stock rapido, acerto manual e alerta de stock baixo
- `5228778` feat(cozinha): alerta de stock baixo e rejeicao de pedidos repoe stock
- `4518c3c` feat(pos): mesas, pagamento em dinheiro com troco e pedidos em aberto
- `f215455` feat(caixa): transferir saldo entre eventos
- `4100efe` fix(styles): popup nativa de select em dark
- `dd07d3d` fix(select): dropdown qr-order
- `d3b6d32` feat: dropdown evento custom

**Pendente**
- Auditoria sem `before` — registado como dívida #1 no `PLAN.md`.

---

## Template para nova entrada

```markdown
## AAAA-MM-DD — <título curto>

**Objectivo**: <uma frase>

**Feito**
- ...

**Decisões tomadas**
- ... (só as não-óbvias)

**Commits**
- `<hash>` <tipo>(<área>): <descrição>

**Gates**
- Backend: <resultado>
- Frontend: <resultado>

**Pendente**
- ...
```

# SenhasFestas — Plano

> Documento vivo. Actualizar no fim de cada batch.
> Referência obrigatória antes de iniciar trabalho.

---

## O que é

SaaS para gestão de senhas/tokens para consumo em festas de aldeia.
Eventos com bar, cozinha, caixa, saldos de cliente em cartão, QRs de
mesa e relatórios financeiros.

## Stack

- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend**: Next.js 15 (App Router) + Tailwind + React 18
- **Partilhado**: `@senhasfestas/shared` (`packages/shared`) — contrato de realtime (tipos, canais, eventos, rooms)
- **Auth**: JWT (access + refresh em cookie httpOnly same-origin)
- **Realtime**: Socket.IO (canal de pedidos, KDS)
- **Deploy**: Vercel (frontend) + backend Node
- **Repo**: github.com/smpsandro1239/SenhasFestas (branch `main`)

## Papéis

`superadmin` · `organizer` · `cashier` · `bar` · `kitchen` · `treasurer` · `client`

## Mapa da aplicação

| Rota | Propósito |
|---|---|
| `/` | Início |
| `/pedidos` | Pedidos do cliente |
| `/cozinha` | KDS (Kitchen Display System) |
| `/caixa` | Fecho de caixa + movimentos de saldo |
| `/relatorios` | Relatórios financeiros |
| `/saldo` | Saldo do cliente |
| `/qr-order` | Menu QR (cliente) |
| `/publico` | Ecrã público (pedidos prontos) |
| `/admin` | Admin — tabs: Eventos, Produtos, Utilizadores, Saldos, Configuração, Auditoria, Planta |

---

## Estado actual — funcional

### Núcleo
- [x] Autenticação (login, registo, refresh, enter-event)
- [x] Eventos (criar, editar, status, shortCode, settings)
- [x] Membros por evento com roles
- [x] Catálogo (produtos, categorias, import entre eventos)
- [x] Pedidos (QR + POS)
- [x] Cozinha/KDS com realtime
- [x] Saldos (carregar, descontar, estornar, arquivar, transferir entre eventos)
- [x] Caixa (abrir, fechar, histórico)
- [x] Relatórios + export CSV
- [x] Auditoria (logs, filtros, export CSV)

### Melhorias #1–#10 (concluídas)
- [x] **#1** Reabastecimento rápido de stock
- [x] **#2** Alerta de stock baixo
- [x] **#3** Acertos de stock com registo de auditoria
- [x] **#4** Pagamento cash no POS com troco
- [x] **#5** Totais por mesa no POS
- [x] **#6** Reversão de stock na rejeição da cozinha
- [x] **#7** Estado "pronto p/ entrega" com alerta ao balcão
- [x] **#8** Transferência de saldo entre eventos no caixa
- [x] **#9** Dropdown de evento uniformizado com o design system
- [x] **#10** Gerador de QRs por mesa em lote (A4 imprimível)

### Fase 2 — Planta das mesas (concluída)
- [x] Editor drag & drop
- [x] Lugares por mesa + "aplicar a todas"
- [x] Zonas da sala com pertença derivada
- [x] Export PNG
- [x] Persistência no servidor (jsonb + optimistic locking 409)
- [x] Pendente por evento (edição não sincronizada)
- [x] Auto-organizar por zonas
- [x] QRs agrupados por zona
- [x] Export PDF por zona (uma folha por zona)

---

## Próximas fases

### Prioridade alta (curto prazo)

1. **Testes de integração do fluxo de pendente da planta**
   - **Porquê**: é onde os bugs têm aparecido; só há testes de helpers puros.
   - **O quê**: `decidirPlantaRemota` está testada; falta testar o **efeito** que a
     chama.
   - **Ficheiros**: `frontend/src/app/admin/page.tsx`, `frontend/src/lib/planta.test.ts`
   - **Estado**: concluído 2026-10-19 — o mapeamento decisão→efeito saiu do efeito
     para o helper puro `resolverPlanoCargaPlanta` (`lib/planta.ts`); o efeito
     aplica o plano. 5 testes cobrem os 5 ramos (aplicar, ignorar,
     oferecer-importacao, conflito-pendente com `pendenteTs`, retomar com
     mesas+zonas pendentes). Antes: 227 testes; agora: 232.

2. **Undo para zonas**
   - **Porquê**: hoje só mesas têm undo. Apagar uma zona com 10 mesas é irreversível.
   - **O quê**: o snapshot já guarda `{mesas, zonas}`; falta oferecer o undo nas
     operações de zona (`adicionarZonaPlanta`, `removerZonaPlanta`, `editarZonaPlanta`).
   - **Ficheiros**: `frontend/src/app/admin/page.tsx`
   - **Estado**: concluído 2026-10-19 — as 3 operações tiram snapshot antes e
     chamam `oferecerUndo` depois (`Zona adicionada`/`Zona removida`/`Zona editada`);
     banner e botão "Desfazer" já eram genéricos. Nota: o nome editado a teclar
     oferece undo por tecla (última alteração) — arquitectura existente
     (`definirDocumento` limpa o undo sempre).

3. **Feedback visual no export PNG**
   - **Porquê**: se o `Image.onload` falha, o botão não faz nada.
   - **O quê**: `setPlantaSync('a exportar…')`, `try/catch`, mensagem de erro.
   - **Estado**: concluído 2026-10-19 — estado dedicado `exportarEstado`
     (`'' | 'a-exportar' | 'erro'`) em vez de sobrecarregar `plantaSync` (que é
     a sincronização com o servidor); fluxo `async/await` com `try/catch` real
     (onerror, `getContext`, `toBlob`); botão desactivado durante o export.
     Verificado no browser: download real + mensagem de erro forçada.

### Prioridade média (semanas)

4. **Auditoria com `before`/`after` nos PUT da planta**
   - **Porquê**: hoje só se guarda o resultado final; não se sabe o que mudou.
   - **O quê**: o serviço guarda o `floorPlan` anterior; o interceptor passa-o.
   - **Estado**: concluído 2026-10-19 — `guardarPlanta` expõe o estado anterior
     por callback; o controller arquiva-o no pedido (`definirAuditBefore`) e o
     `AuditInterceptor` grava `before` junto do `after` (com o mesmo
     `resumoResposta` de corte a 8000 chars). Só na rota da planta por agora:
     outras rotas continuam a registar só `after` (dívida #1 parcialmente
     resolvida).

5. **Validação visual com Chrome DevTools MCP**
   - **Porquê**: drag de zonas, sobreposição mesa-zona, resize — nada disto é
     testável unitariamente.
   - **Estado**: MCP instalado (`cdt`), precisa de restart + app a correr.
     Alvo definido: evento `festa-teste-2026` (aceite polir evento existente).
   - **Nota**: validação feita por Playwright (não `cdt`) em 2026-10-19 — login,
     criar mesas/zona, drag para dentro de zona, auto-organizar e export PNG
     confirmados (ver `PROGRESS.md`). O `cdt` continua a faltar validar em si.
   - **Realtime da planta agora tem suite Playwright reutilizável**
     (`frontend/e2e/planta-realtime.spec.ts`, 2026-10-20): dois contextos provam
     adopção remota (sem reload) e aviso com edição local preservada; cria/apaga
     evento `e2e-*`.
   - **Ligada ao CI** (`2026-10-20`): job `browser-e2e` em `.github/workflows/ci.yml`
     — Postgres+Redis como serviços, migrações, build backend+frontend, arranque
     de ambos, `wait-on`, Chromium do Playwright (`E2E_CHANNEL=chromium`) e
     `planta-realtime.spec.ts`+`security-headers.spec.ts`. Semeia o admin por
     `BOOTSTRAP_ADMIN_EMAIL/PASSWORD`. `deploy` passou a `needs: [backend,
     frontend, browser-e2e]` (uma regressão de realtime bloqueia o deploy).
     Validado localmente com a config exacta do CI (2 passed).

6. **Validação de sobreposição de zonas**
   - Avisar quando duas zonas se sobrepõem significativamente.
   - **Estado**: concluído 2026-10-19 — helper `paresDeSobreposicao` (fracção da
     menor zona ≥ 20%) + aviso `text-amber` sob a planta. Só avisa: sobreposição
     intencional (ex.: palco sobre zona) continua permitida.
   - **Verificação**: Playwright com Chrome real em `festa-teste-2026` — 3 zonas
     sobrepostas → aviso com os 3 pares (ver `PROGRESS.md`).

7. **Aumentar `MAX_ZONAS_PLANTA`** de 50 para 100 (salões grandes).
   - **Estado**: concluído 2026-10-19 — constante partilhada no DTO
     (`@ArrayMaxSize`) e no serviço; frontend usa a mesma constante.

### Prioridade baixa (meses)

8. **Export PDF com separadores por zona** — cada zona numa folha, com QRs das
   respectivas mesas.
   - **Estado**: concluído 2026-10-20 — sem dependências novas: o lote de QRs com
     "Agrupar por → Zona" passa a compor as folhas por zona (`agruparFolhasPorZona`
     em `lib/qr-lote.ts`; um título de zona por folha, `break-after: page` já
     existente no `body[data-print='lote']`). Os grupos são fixados na geração e
     **recalculados ao mudar o selector** para "Zona" com um lote da planta já
     gerado (senão o selector dizia "Zona" e as folhas continuavam em chunks); um
     lote manual (diálogo de QRs) repõe o selector em "Ordem da planta". Zonas
     vazias não geram folha; uma zona que não cabe continua na folha seguinte com
     o título repetido; lugares já ajustados sobrevivem ao recálculo.
   - **Decisão (2026-10-20, confirmada)**: **manter "Imprimir → Guardar como PDF"**
     (zero dependências). `jspdf` (download directo em um clique) fica descartado
     por agora: exigiria gerar os QRs como imagens e reimplementar a paginação.
   - **Verificação**: Playwright em `festa-teste-2026` — gerar com "Ordem da
     planta" (1 folha sem títulos), mudar **só o selector** para "Zona" → 2 folhas
     ("Zona 1" com a Mesa A; "Sem zona" com B e C), PDF com `data-print='lote'` em
     2 páginas; volta a "Ordem da planta" → 1 folha sem títulos; lote manual →
     selector em "Ordem da planta". O texto do PDF não é extraível (fontes
     subsetadas do Chrome): a prova de conteúdo é o DOM em modo print, que é o que
     define as quebras de página.
9. **Rotação de mesas** — útil para layouts não-alinhados.
   - **Estado**: concluído 2026-10-19 — `Mesa.rotacao` (graus inteiros 0–359,
     opcional no DTO; omissão = 0), shape rodada em torno do centro no canvas e no
     export SVG/PNG com o rótulo sempre direito; controlos input/±45° e atalhos
     `r`/`Shift+R`.
10. **Dimensões reais (metros)** — impressão à escala.
    - **Estado**: concluído 2026-10-19 — `dimensoes: {larguraM, alturaM}` opcional
      no documento da planta (1–200 m, uma casa decimal); inputs no admin, canvas
      com a proporção real e export PNG a 100 px/m com barra de escala. O serviço
      preserva as dimensões guardadas quando o payload as omite (drag de mesas
      não as apaga).
11. **Multi-planta** — salão + esplanada por evento.
    - **Estado**: concluído 2026-10-20 — tabela `floor_plans` (nome único por
      evento, JSONB `documento`, `version` por planta), CRUD em
      `/events/:id/plantas` e compatibilidade com `/events/:id/planta` (linha
      `"Principal"`). No admin há selector de planta, criar/renomear/apagar (nunca
      a última), cache/pendente em `localStorage` **por planta** e migração das
      chaves legadas (sem id) para a planta activa. Sem limite de plantas por
      evento. `events.floorPlan`/`floorPlanVersion` removidos.
12. **Planta em realtime (WebSocket)** — em vez de polling + PUT manual.
    - **Estado**: **concluído 2026-10-20** (backend + frontend).
    - **Backend**: o `OrderGateway` (socket.io) emite `emitPlantaUpdate(eventId,
      plantaId, version, tipo)` num canal próprio (`planta:updates`), com re-emissão
      `plantaUpdated` para a room **`event:<id>:planta`** (reservada a
      `MANAGEMENT_ROLES` via `joinEventPlanta`; a room geral dos pedidos deixou de
      receber metadados de planta). `tipo` ∈ `criada|guardada|renomeada|apagada`
      desambigua o rename (que não incrementa `version`). O `FloorPlanService` emite
      após cada mutação bem-sucedida (não em 409/404/400). O evento **não** transporta
      o documento (o cliente refaz o GET). Robustez: o gateway só distribui via Redis
      quando o subscriber está `ready`; com Redis em baixo cai na emissão local
      directa.
    - **Frontend**: `use-planta-socket` liga ao canal e reemite; `decidirAdocaoRemota`
      (helper puro, 9 testes) decide entre ignorar (outra planta), ignorar-eco
      (mesma `version`), refetch da lista (renomeada/apagada — `getPlanta` daria 404),
      avisar (edições locais/conflito, guardadas como pendentes ao recarregar) ou
      adoptar (GET + aplica com guards). O mecanismo 409 mantém-se como rede de
      segurança; sem polling novo.
13. **Bump periódico do `chrome-devtools-mcp`** — está pinado em `1.11.0` (o
    `@latest` dava superfície de ferramentas não-determinística: 30 numa execução,
    32 noutra). O pin exige bump manual para receber correcções de bugs e
    ferramentas novas; sem isto a versão fica presa. **Verificado 2026-10-20**:
    `npm view chrome-devtools-mcp version` → `1.11.0` e `dist-tags.latest` →
    `1.11.0`, ou seja o pin **já é a versão mais recente** — não há bump a fazer
    enquanto não sair uma nova.

---

## Dívida técnica registada

Os números desta tabela são as chaves da dívida técnica (no `TODO.md` aparecem
como `D<n>`). Não confundir com os itens numerados do roadmap (no `TODO.md` como
`R<n>`) — o `D13` e o `R13` são coisas diferentes.

| # | Descrição | Onde | Impacto |
|---|---|---|---|
| 1 | ~~Auditoria do interceptor só captura `after`~~ **Resolvido 2026-10-19** | `audit.interceptor.ts` | Suporte a `before` (+ `eventId`/`entityId`/`extras`) no interceptor; **todas as rotas de escrita** (catalog update/delete/stock, cash-closure abrir/fechar, balance load/deduct/reverse/transfer/extend/unarchive/notified, order status/cancel, kitchen status, public-screen entregue, event update/status/settings/members/remove, user update/remove, planta PUT) arquivam o estado anterior num mecanismo único (os registos directos do `AuditService` no catalog/cash-closure foram removidos — duplicavam). Criação e `POST /import` não têm `before` por não existir estado anterior |
| 2 | ~~Undo não cobre zonas~~ **Resolvido 2026-10-19** | `admin/page.tsx` | Adicionar/editar/remover zona agora oferecem undo de 6 s |
| 3 | ~~`plantaAviso` limpo no arranque da carga~~ **Resolvido 2026-10-19** | `admin/page.tsx`, `lib/planta.ts` (`pendentesDeOutrosEventos`) | O aviso de edições por sincronizar passou a ser **derivado** das chaves `sf:planta-pendente:*` (que só existem após uma falha), sobrevive a reload e não é apagado pela carga. Cada evento pendente tem botão «Ir para …» |
| 4 | ~~`pendenteTs` congelado no render~~ **Resolvido 2026-10-19** | `admin/page.tsx` | O painel de conflito re-renderiza a cada 30 s (`agoraIdade` + intervalo activo só com o painel aberto), passando o `agora` a `descreverIdade` |
| 5 | ~~`plantaEditadaDesdeCargaRef` nunca resetada no sucesso~~ **Resolvido 2026-10-19** | `admin/page.tsx` | Passou a haver `plantaEdicaoSeqRef` (contador de edições) e `marcarPlantaEditada()`; a gravação com sucesso limpa a flag **só se não houve edições entretanto** (`seqDoEnvio === seq`), e adoptar o servidor/descartar o local também a limpa (`esquecerEdicoesLocais`). Verificado no browser com um GET retido a responder depois da gravação |
| 6 | ~~O fundo da zona assumia hex de 6 dígitos~~ **Resolvido 2026-10-19** | `admin/page.tsx:4215` (não `renderSvgPlanta`, que já usava `fill-opacity`) | Era `` `${zona.cor}22` ``: com `#08f`, `#rrggbbaa`, `rgb()` ou nomes de cor o browser descarta a declaração e o fundo desaparecia. Passou a `fundoZona(cor)` = `color-mix(in srgb, <cor> 16%, transparent)` (helper puro testado), alinhado com os 16% do PNG |
| 7 | ~~Export PNG sem feedback de erro~~ **Resolvido 2026-10-19** | `admin/page.tsx` | Estado `exportarEstado` + `try/catch` + mensagem de falha; verificado no browser |
| 8 | ~~SWC do frontend **truncado** (18,4 MB instalados vs 148,4 MB esperados)~~ **Resolvido 2026-10-19** | `node_modules/@next/swc-win32-x64-msvc` | Reinstalado (`rm -rf` + `npm install --prefer-online`): 148 386 816 B certos, binário carrega sem erro, build frio 80 s → 72 s e zero avisos «Attempted to load @next/swc…». Nota: o magic `MZ` era normal (PE do Windows) — o sinal real era o tamanho |
| 9 | ~~`/health/ready` devolve **HTTP 200** mesmo com dependência `unhealthy`~~ **Resolvido 2026-10-19** | `health.controller.ts` | Passa a **503** se a BD falhar ou o Redis estiver configurado e não pronto; Redis ausente reporta `disabled` (não conta como falha). Verificado em execução real (200/503) |
| 10 | ~~CSP (`script-src 'self' 'unsafe-inline'`) bloqueia `eval` do webpack em dev~~ **Resolvido 2026-10-19** | `next.config.js` | `'unsafe-eval'` adicionado só quando `!isProd`; hidratação verificada em dev, produção mantém CSP estrito |
| 11 | ~~Rótulos acessíveis duplicam o prefixo (`"Mesa Mesa A"`, `"Zona Zona 1"`)~~ **Resolvido 2026-10-19** | `lib/planta.ts` (`rotuloAcessivel`) | `aria-label` só prefixa quando o nome não começa já pelo prefixo (palavra inteira), verificável no browser |
| 12 | ~~Versão-base da planta é **do evento anterior** enquanto o GET do evento novo não resolve~~ **Resolvido 2026-10-19** | `admin/page.tsx` (`plantaVersoesRef`/`plantaGravarAdiadoRef`) | Passou a haver versão **por evento** (`{shortCode: version}`); sem versão conhecida a gravação é **adiada** (`plantaGravarAdiadoRef`) e reenviada quando o GET resolve — deixa de haver 409 espúrio ao trocar de evento e editar. Se o GET falhar (offline), a edição adiada fica registada como `pendente` (`registarPendentePlanta`, com `version` opcional). Verificado no browser: troca de evento com GET retido + arrasto → PUT com a versão certa → 200, sem painel de conflito |
| 13 | ~~`TipoAlteracaoPlanta` **definido duas vezes** (`backend/src/websocket/order.gateway.ts` e `frontend/src/lib/planta.ts`)~~ **Resolvido 2026-10-21** | `packages/shared` | O contrato de realtime passou a um pacote partilhado, `@senhasfestas/shared` (npm workspace): `TipoAlteracaoPlanta`, `CANAIS_REALTIME`, `EVENTOS_SOCKET`, `MENSAGENS_ENTRADA`, `roomEvento` e `roomPlanta` têm uma só definição, consumida pelo gateway do backend e pelos hooks `use-order-socket`/`use-planta-socket`. Uma divergência de string (`'joinEventPlanta'` vs `'joinPlanta'`) passa a falhar em `tsc` e não em runtime |
| 14 | ~~`use-planta-socket` sem indicador de estado~~ **Resolvido 2026-10-21** | `frontend/src/lib/use-planta-socket.ts` | Passou a devolver `{ status: OrderSocketStatus }` e o `admin` mostra um badge de realtime ("Realtime ligado" / "a reconectar" / "sem realtime"). Para não duplicar a lógica, `criarSocketAutenticado` foi generalizado (`roomEvent`/`mensagem`/`onMessage`) e é agora o mesmo motor dos dois hooks. +2 testes de status (297 no total) |
| 15 | E2E socket de 2026-10-20 **subiu a `version` da planta real** | evento `festa-teste-2026`, planta `e0979241-…` | `version` 1→30 (nome reposto para "Principal"). Monotónica, sem impacto prático (não há cliente com cache < 30), mas registado para não surpreender um 409 futuro. E2E futuro deve usar evento `e2e-*` e apagá-lo no fim |
| 16 | ~~`ts-node` (de que o CLI do TypeORM depende) ficou **aninhado** em `backend/node_modules/` com as workspaces~~ **Resolvido 2026-10-22** | `package.json` (raiz), `backend/package.json` | O `ts-node` passou a `devDependencies` da **raiz** (`~10.9.2`) → o npm hoista-o para `node_modules/ts-node` e o `require('ts-node')` do CLI do TypeORM resolve (commit `f62d71b`). Regra mantida: o tooling que os scripts da raiz invocam (CLI do TypeORM, `nest`) tem de estar declarado **na raiz**, não só no workspace que o usa |
| 17 | O rate limit **falha aberto** quando o Redis está configurado mas inacessível | `backend/src/middleware/audit.middleware.ts` | Se o `REDIS_CLIENT` existe mas o `incrementWithTtl` devolve `null` (Redis inacessível), o contador vale 0 e o pedido passa **sem contar e sem limite** — o `next()` acontece antes da contagem local. O comentário no código promete "fail-closed ... cai na contagem local", mas a contagem local só corre quando a chamada **lança** exceção. Reproduzido localmente sem Redis: 6 pedidos seguidos → todos 200 com `RATE_LIMIT_MAX=3`. Tarefa `T36` |
| 18 | O pré-voo do e2e não garante que a base de dados é local | `backend/test/app.e2e-spec.ts` | O spec faz `DROP SCHEMA public CASCADE` + `runMigrations()` e o pré-voo limita-se a probear a BD configurada. Com o `.env` apontado para uma BD remota (Neon), correr `npm run test:e2e` local apagaria o schema remoto. O pré-voo também ignora `DB_SSL=true` (só liga o SSL quando existe `DATABASE_URL`) → falha com "connection is insecure" em vez de bloquear com uma mensagem clara. Tarefa `T37` |

---

## Notas operacionais

- **Monorepo npm workspaces (2026-10-21)**: a raiz é o único sítio com lockfile e
  manifesto de workspaces (`packages/*`, `backend`, `frontend`). Consequências:
  - Instalar **na raiz** (`npm ci`), nunca por pasta — um `npm ci` em `backend/`
    deixava de trazer o pacote partilhado. O `backend/package-lock.json` stale
    (pré-workspaces) foi removido do índice.
  - O pacote partilhado compila com `npm run build:shared` (TypeScript na raiz,
    5.7.3) e tem de existir **antes** de qualquer build ou teste. O `postinstall`
    (`scripts/build-shared.js`) compila-o automaticamente quando há compilador
    disponível; em instalações `--omit=dev` não compila (o runtime recebe o
    `dist` do builder).
  - O TypeScript é unificado na raiz (5.7.3). O `@nestjs/schematics` exige
    `typescript >= 6.0.0` como peer — resolvido com um `overrides` na raiz, que
    o alinha na mesma versão do resto do código.
- **`outputFileTracingRoot` e o layout do standalone**: com o pacote partilhado
  fora de `frontend/`, o `next.config.js` define
  `outputFileTracingRoot: path.join(__dirname, '..')`. Efeito: o standalone
  espelha a raiz do repositório e o entrypoint passa a estar em
  `frontend/server.js` (e não `server.js`). O `public` e o `.next/static` têm de
  ir para `frontend/public` e `frontend/.next/static`. **Qualquer cópia em CI,
  Docker ou Vercel tem de respeitar este layout.**
- **Docker**: o build context é a raiz (`docker-compose.yml` usa `context: .`).
  No runtime do backend o `npm ci` corre com `--omit=dev` (sem compilador), por
  isso o `packages/shared/dist` é copiado do builder para
  `packages/shared/dist` — o `node_modules/@senhasfestas/shared` é um symlink
  para `packages/shared` e não pode ser copiado como directório.
- **Vercel (2026-10-21)**: o projecto `senhas-festas` tem de ter a **raiz do
  repositório** como *root directory* — é o que faz o `npm ci` da raiz trazer as
  workspaces e o `outputFileTracingRoot` (`path.join(__dirname, '..')`) abranger
  o `packages/shared`. A configuração do projecto (root directory, build command,
  output directory) vive no dashboard da Vercel e **não é verificável a partir do
  repositório**: fica a verificar. O build serverless (`build.vercel.mjs` →
  `backend/build.vercel.mjs`) agora corre `npm run build:shared` antes do
  `nest build`, para o `dist` do pacote partilhado existir quando o esbuild
  embute o gateway; verificado localmente (o bundle contém `order:updates`,
  `planta:updates`, `joinEvent`, `joinEventPlanta`, `plantaUpdated`,
  `orderUpdated`).
- **`overrides` do TypeScript e o `nest g`** (2026-10-21) — **decidido: manter**.
  O `overrides` da raiz (`@nestjs/schematics` → `typescript ~5.7.3`) fixa o
  compilador do schematic na mesma versão do resto do código. Verificado:
  `npx nest g resource tmpProbe --dry-run` sai **0** (anuncia os 9 ficheiros
  esperados e não escreve nada em disco).
  O peer `typescript >= 6.0.0` do `@nestjs/schematics@12` fica **violado em
  declarado** — mas a violação não é do `overrides`: sem ele, a re-resolução do
  lockfile produz **exactamente a mesma árvore** (TypeScript 5.7.3 na raiz,
  schematic dedupeado para 5.7.3, zero entradas diferentes no lock) e o npm
  também não trava (exit 0, sem `ERESOLVE`). O `overrides` torna a resolução
  explícita e independente das heurísticas de peer do npm. Aceitar TypeScript 6
  na raiz mudaria o compilador de todo o projecto — não é o que o `overrides`
  faz, nem o que a sua remoção faria.
- **Cron `cleanupExpiredTokens`** (`auth.service.ts:252`, `EVERY_DAY_AT_3AM`) — **Resolvido 2026-10-21**:
  passou a existir `/api/cron/cleanup-tokens` (GET/POST, gated por `CRON_SECRET`),
  ligado no `vercel.json` (`0 3 * * *`), para correr em serverless onde o `@Cron`
  não dispara. Contagens observadas antes do fix (322 expirados, 187 revogados >30d)
  continuam a justificar correr a limpeza. O `@Cron` mantém-se para o modo processo
  (`main.ts`).
- **Realtime single-instance**: sem Redis o realtime **funciona** numa só instância
  (emissão local directa em `order.gateway.ts`). Degrada apenas em multi-instância
  (sem fan-out entre réplicas) e nos limites partilhados de join/sockets, que passam
  a mapas locais (`order.gateway.ts:34-36`).
- **WebSocket indisponível em serverless**: o `serverless.main.ts` reutiliza
  `criarAplicacao`/`AppModule`, logo o `OrderGateway` **é instanciado**, mas o runtime
  serverless (Vercel) não suporta ligações WS persistentes nem faz fan-out entre
  invocações — na prática não há `orderUpdated` nem `plantaUpdated`. O deploy com
  realtime tem de usar o `main.ts` (processo Node persistente).
- **Crons de arranque**: o arranque do backend não muta dados. O único `@Cron` corre
  às 3AM, logo arranques fora dessa hora são seguros.
- **Suite browser Playwright** (`frontend/e2e/*.spec.ts`): não corre por omissão —
  exige `E2E_BASE_URL` (e `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, `E2E_CLIENT_*`
  para `session.spec.ts`). Local: backend em `:3000`, `npm run dev --workspace
  frontend` em `:3001`, depois
  `E2E_BASE_URL=http://localhost:3001 E2E_CHANNEL=chrome E2E_ADMIN_EMAIL=…
  E2E_ADMIN_PASSWORD=… npx playwright test` a partir de `frontend/`. **No CI** corre
  no job `browser-e2e` (Chromium do Playwright, `E2E_CHANNEL=chromium`).

---

## Decisões arquitecturais fixadas

### Planta
- **Documento jsonb** `{ mesas, zonas, dimensoes? }` no `EventEntity.floorPlan`,
  com `floorPlanVersion` para optimistic locking.
- **Pertença derivada**: mesa pertence à zona cujo rectângulo contém o seu centro
  (primeira em sobreposição). Sem `Mesa.zonaId`.
- **Coordenadas em %**: `Mesa.x/y` = centro; `Zona.x/y` = canto superior esquerdo.
  Escala com o ecrã.
- **Dimensões reais** (opcional): `dimensoes: {larguraM, alturaM}` (1–200 m, 1
  decimal) vive no próprio documento — viaja com import/export e com o 409. O
  serviço **preserva** as dimensões guardadas quando o payload as omite (saves de
  mesas/zonas e clientes antigos não as apagam). Com dimensões: canvas usa a
  proporção `larguraM/alturaM` (sem elas, 16:9) e o export PNG sai a 100 px/m com
  barra de escala (25% da largura = `larguraM/4`), limitado a 6000 px por lado.
  Sem dimensões o export mantém 1600×1600.
- **Limites**: `MAX_MESAS_PLANTA=200`, `MAX_ZONAS_PLANTA=100`, `MAX_LUGARES_MESA=99`,
  `ZONA_MIN=5`.
- **Paleta fixa** de 6 cores (não cor livre).
- **409** devolve `{ message, mesas, zonas, version }` (mais `dimensoes` quando
  existem); o cliente reconcilia.
- **Pendente por evento** em `localStorage` (`sf:planta-pendente:<shortCode>`) com
  `{mesas, zonas, version, ts}`. **Só existe após uma gravação falhada** (é removida
  em cada sucesso), logo é a fonte de verdade do aviso «edições por sincronizar
  noutros eventos» — `pendentesDeOutrosEventos` deriva-o das chaves, em vez de o
  guardar em estado (sobrevive a reload/re-render).
- **Rotação**: `Mesa.rotacao` em graus inteiros 0–359 (opcional no DTO; ausente
  = 0). Roda a **forma** em torno do centro, não o rótulo. `Mesa.forma='redonda'`
  é invariante à rotação (círculo); só a quadrada (rectângulo 1:0.85, igual no
  canvas e no SVG) mostra o ângulo.
- **`decidirPlantaRemota`**: `editadoDesdeCarga` → `ignorar`;
  `pendenteVersao === versaoServidor` → `retomar-pendente`; senão
  `conflito-pendente`; senão `oferecer-importacao`/`aplicar`.

### Saldos
- Carregamento/desconto exigem `eventId` (evita saldo sem scope).
- Transferência entre eventos: origem `CANCEL`, destino `LOAD`, numa transação.
- Arquivamento: saldo inutilizável mas visível; soft-delete 30 dias depois.
- Só `FINANCE_ROLES` mexe em saldo.

### Stock
- `stock: null` = sem controlo; número = controlo (abate a cada pedido, repõe no
  cancelamento).
- Cancelamento repõe stock em `order.service` e `kitchen.service` (helper
  partilhado `reporStockEmTransacao`).
- Acertos com motivo → audit `STOCK_ADJUST`.

### Autenticação
- Access token em memória, refresh token em cookie httpOnly same-origin.
- Roles efectivas derivadas de `EventUserEntity` (event-role) dentro do evento;
  `superadmin` global é imune.

### Auditoria
- Um **mecanismo único**: o interceptor global captura o `after` (resumo da resposta) e,
  quando a rota o fornece, o `before`/`eventId`/`entityId`/`extras`. O **serviço** constrói
  o snapshot completo (`antes` + `eventId` + `entidadeId` + `extras`) e o **controller** só
  o arquiva via `arquivarAuditoria(req)` (factory que fecha `definirAuditBefore` +
  `definirAuditEvento` + `definirAuditEntidade`). Os serviços de domínio **não** injectam o
  `AuditService` — não há registos duplicados.
- `eventId`/`entityId`: derivados de `params`/`body` pelo interceptor, ou sobrepostos pelo
  serviço nas rotas que não os trazem (produto→evento, pedido→evento, caixa→evento, id da
  caixa criada). `undefined` **preserva** o valor derivado.
- Snapshots **sem relações pesadas**: `catalog.update`/`softRemove` excluem a relação
  `event` e `event.update` exclui o `floorPlan` — acima de 8000 chars o interceptor
  substitui o `before` por `{resumo:'resposta extensa'}` e perde-o.
- `snapshot()` remove `password`/`token`/`refreshToken`/`tokenHash` (profundidade 4,
  arrays cortados a 50); o `before` de `user` usa `toPublicUser` (subconjunto público).
- Rotas **sem** `before` por não haver estado anterior: criação de eventos,
  produtos, utilizadores, membros, categorias, caixas e pedidos; `POST /import`;
  login/logout (estas têm acções próprias na auditoria). Não é um buraco: não há
  o quê capturar antes.

---

## Convenções

Ver `REVIEW.md`. Resumo: PT europeu, helpers puros testáveis (FIRST), gates
completos antes de commit, commits atómicos, push só com autorização.
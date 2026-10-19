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
12. **Planta em realtime (WebSocket)** — em vez de polling + PUT manual.
13. **Bump periódico do `chrome-devtools-mcp`** — está pinado em `1.11.0` (o
    `@latest` dava superfície de ferramentas não-determinística: 30 numa execução,
    32 noutra). O pin exige bump manual para receber correcções de bugs e
    ferramentas novas; sem isto a versão fica presa.

---

## Dívida técnica registada

| # | Descrição | Onde | Impacto |
|---|---|---|---|
| 1 | Auditoria do interceptor só captura `after` — suporte a `before` **adicionado 2026-10-19**; o PUT da planta passa-o, **outras rotas ainda não** | `audit.interceptor.ts` | Rotas sem `before` continuam sem estado anterior |
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
| 12 | Versão-base da planta é **do evento anterior** enquanto o GET do evento novo não resolve | `admin/page.tsx` (`plantaVersionRef`) | Ao trocar de evento e editar antes da resposta chegar, o PUT envia a versão do evento antigo → **409** e painel de conflito espúrio (a edição fica em `pendente`, sem perda de dados). Visto ao validar a #5. Correcção provável: guardar a versão por evento (`{eventoId: version}`) ou zerá-la na troca e adiar a gravação até a versão chegar |

---

## Notas operacionais

- **Cron `cleanupExpiredTokens`** (`auth.service.ts:252`, `EVERY_DAY_AT_3AM`) — apaga
  refresh tokens expirados/revogados. **Não está a correr**: em 2026-10-19 havia
  **322 tokens expirados há >1 dia** (87 há >7 dias, o mais antigo de 2026-10-05) e
  **187 revogados há >30 dias**. Suspeita: deploy serverless (Vercel) onde o
  `@Cron` do `@nestjs/schedule` não dispara por não haver processo persistente.
  Confirmar e, se aplicável, mover a limpeza para um cron externo (`/api/cron/*`).
- **Realtime single-instance**: sem Redis o realtime **funciona** numa só instância
  (emissão local directa em `order.gateway.ts:254`). Degrada apenas em multi-instância
  (sem fan-out entre réplicas) e nos limites partilhados de join/sockets, que passam
  a mapas locais (`order.gateway.ts:34-36`).
- **Crons de arranque**: o arranque do backend não muta dados. O único `@Cron` corre
  às 3AM, logo arranques fora dessa hora são seguros.

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

---

## Convenções

Ver `REVIEW.md`. Resumo: PT europeu, helpers puros testáveis (FIRST), gates
completos antes de commit, commits atómicos, push só com autorização.
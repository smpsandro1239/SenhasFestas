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

### Prioridade média (semanas)

4. **Auditoria com `before`/`after` nos PUT da planta**
   - **Porquê**: hoje só se guarda o resultado final; não se sabe o que mudou.
   - **O quê**: o serviço guarda o `floorPlan` anterior; o interceptor passa-o.

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

7. **Aumentar `MAX_ZONAS_PLANTA`** de 50 para 100 (salões grandes).

### Prioridade baixa (meses)

8. **Export PDF com separadores por zona** — cada zona numa folha, com QRs das
   respectivas mesas.
9. **Rotação de mesas** — útil para layouts não-alinhados.
10. **Dimensões reais (metros)** — impressão à escala.
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
| 1 | Auditoria só captura `after` | `audit.interceptor.ts` | Não se sabe o estado anterior |
| 2 | ~~Undo não cobre zonas~~ **Resolvido 2026-10-19** | `admin/page.tsx` | Adicionar/editar/remover zona agora oferecem undo de 6 s |
| 3 | `plantaAviso` limpo no arranque da carga | `admin/page.tsx` | Aviso pode não ser visto |
| 4 | `pendenteTs` congelado no render | `admin/page.tsx` | Idade desactualizada |
| 5 | `plantaEditadaDesdeCargaRef` nunca resetada no sucesso | `admin/page.tsx` | Futuros GETs ignorados até trocar de evento (documentado) |
| 6 | `renderSvgPlanta` assume hex de 6 dígitos | `lib/planta.ts` | Frágil a mudanças de paleta |
| 7 | Export PNG sem feedback de erro | `admin/page.tsx` | Clique silencioso |
| 8 | SWC do frontend **truncado** (18,4 MB instalados vs 148,4 MB esperados; magic `MZ`) | `node_modules/@next/swc-win32-x64-msvc` | Fallback WASM; compilação lenta. Corrigir reinstalando `@next/swc-win32-x64-msvc@15.5.24` |
| 9 | `/health/ready` devolve **HTTP 200** mesmo com dependência `unhealthy` | `health.controller.ts:32-46` | Readiness probe engana load balancers; contrato correcto seria **503** |
| 10 | ~~CSP (`script-src 'self' 'unsafe-inline'`) bloqueia `eval` do webpack em dev~~ **Resolvido 2026-10-19** | `next.config.js` | `'unsafe-eval'` adicionado só quando `!isProd`; hidratação verificada em dev, produção mantém CSP estrito |

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
- **Documento jsonb** `{ mesas, zonas }` no `EventEntity.floorPlan`, com
  `floorPlanVersion` para optimistic locking.
- **Pertença derivada**: mesa pertence à zona cujo rectângulo contém o seu centro
  (primeira em sobreposição). Sem `Mesa.zonaId`.
- **Coordenadas em %**: `Mesa.x/y` = centro; `Zona.x/y` = canto superior esquerdo.
  Escala com o ecrã.
- **Limites**: `MAX_MESAS_PLANTA=200`, `MAX_ZONAS_PLANTA=50`, `MAX_LUGARES_MESA=99`,
  `ZONA_MIN=5`.
- **Paleta fixa** de 6 cores (não cor livre).
- **409** devolve `{ message, mesas, zonas, version }`; o cliente reconcilia.
- **Pendente por evento** em `localStorage` (`sf:planta-pendente:<shortCode>`) com
  `{mesas, zonas, version, ts}`.
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
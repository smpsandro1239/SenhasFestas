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

**Pendente**
- Confirmar bug do `/ready` (corrigir para 503) — a aguardar decisão.
- Decidir alvo do teste visual: evento dedicado, BD de dev, ou aceitar poluir.
- Reinstalar `@next/swc-win32-x64-msvc`.
- Confirmar se o cron corre em produção; se não, mover para cron externo.

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

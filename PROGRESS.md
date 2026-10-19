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

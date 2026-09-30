# Test Kit — Verificação manual em produção

Ritual: executar no ecrã real (UI ou API autenticada), não só nos testes
unitários. Registar cada passo como **passou** / **falhou** / **não testável**.

## Bloco 1 — 1A: operações de saldo limitadas a FINANCE_ROLES

Decisão 1A (em produção desde `55f3880`): só funções financeiras (ou o próprio
cliente no seu saldo) mexem em saldo. bar/kitchen -> 403.

Mensagens a verificar (exatas, vêm do código):

- `A tua função não permite operações de saldo. Contacta o caixa ou o organizador.`
  (`balance-guard.ts`)
- `Não pode usar o saldo de outro utilizador` (`order.service.ts:146`)

| # | Ação | Esperado | Resultado |
|---|---|---|---|
| 1 | Login `bar` → cancela um pedido pago com saldo | 403 com a mensagem de saldo (`A tua função não permite...`) | passou / falhou / não testável |
| 2 | Login `bar` → cria pedido com `paymentMethod: balance` para outro utilizador | 403 com a mensagem de saldo | passou / falhou / não testável |
| 3 | Login `cashier` → repete os passos 1 e 2 | Ambos passam (sem erro) | passou / falhou / não testável |
| 4 | Login client A → cria pedido com saldo do client B | 403 `Não pode usar o saldo de outro utilizador` | passou / falhou / não testável |
| 5 | Registo do Bloco 1 | — | passou / falhou / não testável |

## Bloco 2 — 2A: event-role como role efetiva dentro do evento

Decisão 2A (+D-2): num endpoint com scope de evento, a role efetiva é a
`event-role` (`event_users.role`); superadmin global imune e bypassa
membership; `reports/*` e `users/*` restritos a FINANCE_ROLES.

Configurar: um utilizador de teste com **global `organizer`** e **event-role
`client`** no Magusto.

| # | Ação | Esperado | Resultado |
|---|---|---|---|
| 1 | Login como esse utilizador → `GET /users?q=x` | 403 (a event-role `client` vence a global `organizer`; D-2) | passou / falhou / não testável |
| 2 | Com a sessão ainda ativa, o superadmin promove-o a `cashier` no Magusto (PATCH membro) | `GET /users?q=x` → 200 **imediatamente, sem re-login** — prova que a role vem da BD (D-3), não do token | passou / falhou / não testável |
| 3 | `GET /reports/ordens` (com eventId do Magusto) | 200 (cashier ∈ FINANCE_ROLES) | passou / falhou / não testável |
| 4 | Rebaixar para `client` de novo, sessão ativa → `GET /users?q=x` | 403 imediato, sem re-login | passou / falhou / não testável |
| 5 | Repetir o mesmo com um utilizador de **global `client`** promovido a `cashier` no Magusto → `GET /users/by-access-code/:code` | 200 (elevação por membership funciona) | passou / falhou / não testável |

Critérios adicionais quando houver dois eventos: mesma pessoa com roles
diferentes em cada evento comporta-se conforme a role de cada evento (critério
5 da matriz).

## Bloco 3 — A10: WebSocket re-autentica na reconexão e mostra o estado

Fix A10: o token é relido do getter a **cada** conexão/reconexão (não capturado no
mount); num `connect_error` o cliente faz refresh e re-autentica com o token novo;
se o refresh falhar, a UI mostra o estado em vez de falhar em silêncio. KDS mostra
badge sempre; `/pedidos` só em erro. O polling HTTP (3s/5s) continua como rede de
segurança — não é substituído pelo socket.

| # | Ação | Esperado | Resultado |
|---|---|---|---|
| 1 | Login `cashier` → abrir `/cozinha` e criar um pedido de teste | Pedido aparece na KDS (polling ou socket); badge KDS mostra **Ligado** | passou / falhou / não testável |
| 2 | DevTools → kill a ligação WS (`Network → WS → Right-click → Close` OU `socket.disconnect()` na consola não acessível) | Badge muda para **Reconectando...** e volta a **Ligado** em segundos; pedidos continuam a chegar | passou / falhou / não testável |
| 3 | Expirar o token à força: apagar `accessToken` da memória do módulo não é possível via DevTools → **usar o caminho real de TTL**: esperar ≥15 min OU alterar temporariamente o TTL do JWT para 1 min no backend (não commit) | O refresh roda em `connect_error`; socket volta a ligar com token novo; **Ligado** mantém-se após o TTL | passou / falhou / não testável |
| 4 | Abrir `/pedidos` no mesmo utilizador e repetir o passo 2 | Badge **não** visível quando ligado; aparece **Reconectando...**/**Sem ligação** apenas em erro | passou / falhou / não testável |
| 5 | Sem rede (Flight Mode): KDS perde socket; rede volta | Badge: **Reconectando...** → **Ligado**; sem falha em silêncio permanente | passou / falhou / não testável |

> Nota: objetivo mínimo do A10 é **não mentir ao utilizador** — se a reconexão
> falhar, o estado de erro aparece. A recuperação automática (passos 2-3) é o
> cenário principal; o passo 5 valida o caso de rede intermédia.

## Bloco 4 — A7: ecrã público não expõe financeiro nem notas pessoais

Fix A7: `pedido.total` e `itens.notes` deixaram de ser selecionados nos 3
endpoints públicos sem auth. O ecrã nunca os renderizava (mostra só nº do
pedido, tempo decorrido, mesa e estado) — eram dados mortos servidos a
qualquer pessoa com a URL.

| # | Ação | Esperado | Resultado |
|---|---|---|---|
| 1 | Abrir `/publico?event=<id>` num browser **anónimo** (window privado, sem login) | O ecrã carrega os 3 estados (Recebidos / A Preparar / Prontos) normalmente | passou / falhou / não testável |
| 2 | Na mesma página, DevTools → Network → filtrar `/api/public/pedidos` → ver o **Response** de cada um | Nenhum dos 3 responses contém `total` nem `notes` (nem dentro de `items`) | passou / falhou / não testável |
| 3 | Confirmar visualmente o ecrã: os cards mostram nº do pedido, tempo, mesa e estado | Continua igual ao antes do fix — nada quebra no ecrã | passou / falhou / não testável |
| 4 | `curl https://<api>/api/public/pedidos-prontos?event=<id>` (sem cookies, sem token) | `200`, lista de pedidos **sem** `total` e **sem** `notes` | passou / falhou / não testável |

> Nota: o ecrã é público **por definição** (é uma TV). Não se adicionou auth nem
> token — o que muda é que a URL deixa de revelar quanto cada pessoa gastou e
> notas do tipo alergias/mesa. `PATCH /api/public/pedidos/:id/entregue` já é
> autenticado (`AuthGuard('jwt')` + `RolesGuard`) — não faz parte deste bloco.

## Registo

- Data da execução:
- Executado por:
- Ambiente (URL API / UI):
- Resumo: Bloco 1 — passou __ / falhou __ / não testável __; Bloco 2 — passou __ / falhou __ / não testável __; Bloco 3 — passou __ / falhou __ / não testável __; Bloco 4 — passou __ / falhou __ / não testável __
- Notas (URLs, capturas, mensagens de erro inesperadas):
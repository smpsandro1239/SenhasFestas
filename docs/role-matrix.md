# Role Matrix — Decisão 2A: event-role como teto

Estado: **implementado**. Guard 2A em `backend/src/common/guards/roles.guard.ts`
+ `MembershipService.roleEfetiva` (commit `c5459d4`, deploy `f05903f`);
D-2 restringe `reports/*` e `users/*` a FINANCE_ROLES (commit `2989a23`);
test kit manual em `docs/test-kit.md` (Bloco 1: 1A, Bloco 2: 2A).

## 1. Como funciona hoje (antes do 2A)

O JWT transporta **apenas a role global** (`user.role`). O `RolesGuard`
compara essa role com `@Roles(...)` do controller. A `EventUserEntity.role`
(`event_users.role`) existe na BD mas **não é usada em lado nenhum da
autorização** — foi isto que o B3 demonstrou.

### Inventário de endpoints → roles exigidas

| Controller | Endpoint | @Roles (hoje) |
|---|---|---|
| orders | POST / | ORDER_CREATOR_ROLES (superadmin, organizer, cashier, treasurer, client) |
| orders | PATCH /:id/status | STAFF_ROLES (tudo menos client) |
| orders | POST /:id/cancel | FINANCE_ROLES + client |
| orders | GET /mine, GET / | qualquer autenticado |
| orders | GET /event/:eventId | STAFF_ROLES |
| kitchen | GET orders/pedidos/stats, PATCH status | KITCHEN_ROLES (superadmin, organizer, kitchen, bar) |
| balances | GET /:userId, GET /:userId/history | sem @Roles (guard manual: client só o próprio; FINANCE_ROLES; resto 403) |
| balances | POST load, reverse, deduct; GET outstanding | FINANCE_ROLES |
| cash-closure | abrir, fechar, listar, obter, aberta | FINANCE_ROLES |
| reports | ordens, saldo, total, top-products, series, metodos, movimentos, estatisticas, export.csv | STAFF_ROLES (inclui bar e kitchen!) |
| events | GET /, GET /:id, GET /:id/settings | sem @Roles (scope por membership) |
| events | POST /, PATCH /:id, status, settings, members CRUD | MANAGEMENT_ROLES (superadmin, organizer) |
| events | DELETE /:id | superadmin |
| catalog | GET (com eventId), GET /:id | sem @Roles (scope por membership) |
| catalog | categories, POST, PATCH, DELETE | MANAGEMENT_ROLES |
| users | GET /me | sem @Roles |
| users | GET /, GET /by-access-code/:code, GET /:id | STAFF_ROLES (inclui bar e kitchen!) |
| users | POST / | MANAGEMENT_ROLES |
| users | PATCH /:id, DELETE /:id | superadmin |
| audit | list, export.csv, findOne | AUDIT_ROLES (superadmin, organizer, treasurer) |
| public | GET evento, pedidos-prontos, em-preparacao, recebidos, contagem | sem auth (público) |
| public | PATCH pedidos/:id/entregue | STAFF_ROLES |
| cron | close-events | CRON_SECRET (sem roles) |
| products | GET / (client sem eventId), GET /:id/suggestions | sem @Roles |

Nota 1: **STAFF_ROLES = todos menos client** — portanto bar e kitchen acedem
hoje a `reports/*` e `users/*` (lista de utilizadores e pesquisa por access
code). Este é um buraco pré-existente independente do 2A (ver Decisão D-2).
Nota 2: **`superadmin` sem membership no evento X não é bloqueado** —
`assertMember` faz early return para `superadmin` (bypass); o teto não se
aplica a esta global em lado nenhum.

## 2. Regra proposta (2A)

> **Num endpoint com scope de evento, a role efetiva é a `event-role`**
> (o papel que a pessoa tem nesse evento), **exceto se a role global for
> `superadmin` — que nunca é reduzida** (continua superadmin em todo o lado).
> Sem event-role (não é membro do evento), o acesso é o de hoje:
> `assertMember` falha → 403, salvo `superadmin`.

Não há hierarquia entre roles: dentro do evento a `event-role` substitui a
global por completo. A única exceção é `superadmin` global — cuja global é
imune a qualquer `event-role` inferior.

Não há elevação "não autorizada": passar a `cashier` num evento *é* o efeito
pretendido da membership — a equipa do evento decide quem é o quê lá dentro.
A global serve só para:

- `superadmin` (imune);
- os casos em que não há `event-role` (→ 403, como hoje);
- endpoints **sem scope de evento** (`/users`, `/events`, criar evento, etc.)
  que usam **apenas** a global (o teto só se aplica a operações com scope de
  evento).

### Tabela de role efetiva (global × event-role)

Legenda: valor = role efetiva **num endpoint de evento**.
`(sem membership)` = sem event-role → assertMember bloqueia (403).

| global \ event-role | superadmin | organizer | cashier | treasurer | bar | kitchen | client | (sem membership) |
|---|---|---|---|---|---|---|---|---|
| **superadmin** | superadmin | superadmin | superadmin | superadmin | superadmin | superadmin | superadmin | superadmin (bypass hoje) |
| **organizer** | *ver D-1* | organizer | cashier | treasurer | bar | kitchen | client | — |
| **cashier** | *ver D-1* | organizer | cashier | cashier | bar | kitchen | client | — |
| **treasurer** | *ver D-1* | organizer | cashier | treasurer | bar | kitchen | client | — |
| **bar** | *ver D-1* | organizer | cashier | treasurer | bar | bar | client | — |
| **kitchen** | *ver D-1* | organizer | cashier | treasurer | kitchen | kitchen | client | — |
| **client** | *ver D-1* | organizer | cashier | treasurer | bar | kitchen | client | — |

A tabela é a regra pura: a coluna é a `event-role` (a linha só importa para
`superadmin`). Todo o corpo é a event-role — confirma que a regra é única.

### Consequências diretas da regra

- `organizer` global + `event-role: client` → **client**: sem acesso a
  `users/*` daquele evento, sem `reports/*`, sem `balances` de terceiros.
  Pode ver os próprios pedidos (`GET /orders/mine`) e carregar o próprio saldo
  no caixa (ação de cliente).
- `organizer` global + `event-role: bar` → **bar**: pode KDS (kitchen), NÃO
  mexe em saldo (guard 1A já em vigor), NÃO vê reports/users.
- `client` global + `event-role: cashier` → **cashier**: pode usar a câmara QR
  do caixa (`GET /users/by-access-code/:code`) e criar pedidos. É o efeito
  pretendido — a membership decide o papel dentro do evento.
- `superadmin` global + `event-role: client` → continua superadmin em tudo
  (imunidade).

## 3. Decisões

### D-1. `event-role: superadmin` (default fechado)

`superadmin` só é atribuído no bootstrap (global). `event-role: superadmin` não
deve existir em produção; se aparecer, é **bug de dados, não caso de desenho**.
**Decisão (default, sem custo de pergunta):** registar e ignorar — tratar como
a event-role real que é; como o global superadmin é imune, e os globais
inferiores não podem criar esse valor, não há caminho de exploração. Não
mudamos a criação de membros por causa disto.

### D-2. Buraco STAFF_ROLES em `reports/*` e `users/*` — decisão separada do 2A

Hoje bar/kitchen passam em `reports/*` (relatórios financeiros) e `users/*`
(lista de utilizadores, pesquisa por access code) porque STAFF_ROLES = tudo
menos client. Isto é **exposição que existe hoje, com ou sem event-role** — não
é do 2A.

**Decisão (aberta — única pergunta de produto):** restringir estes endpoints a
**FINANCE_ROLES** existente (superadmin, organizer, cashier, treasurer) e
retirar bar/kitchen, OU manter o estado atual. Não criar `VIEWER_ROLES` — teria
exatamente os mesmos membros que FINANCE_ROLES e criaria duas fontes de verdade
(é o padrão que originou o B1). Se um dia os conjuntos divergirem, cria-se a
constante nova com justificação.

Recomendação: usar FINANCE_ROLES (o padrão do sistema é "quem vê finanças =
quem gere finanças"; bar/kitchen só precisam do KDS).

Verificação feita: `reports/estatisticas` e `GET /kitchen/stats` devolvem a
mesma forma (`{ recebidos, emPreparacao, prontos, entregues, total }`); o KDS
conta por estado ao vivo, o reports adiciona filtro `from`/`to` e entregues por
`updatedAt` (semântica analítica). Para bar/kitchen, o KDS cobre a necessidade
operacional → D-2 completo é seguro, sem perda de função.

### D-2b. Superadmin e membership (default fechado — mantém comportamento atual)

Comportamento atual (confirmado em `membership.service.ts`):
`assertMember` faz early return para `superadmin` → **o superadmin bypassa a
membership e pode operar em qualquer evento, mesmo sem estar listado como
membro**. Não é só "não reduzido"; é omnipresente.

**Decisão (default): manter A.** Rebaixar para B ("superadmin precisa de se
adicionar a cada evento") seria mudança de comportamento com impacto
operacional e não é o objetivo do 2A. Documentado para não ser redescoberto.

### D-3. Onde resolver a event-role (default fechado — decisão de engenharia)

**Consultar `EventUserEntity` no guard/helper a cada request com scope de
evento.** Dados frescos > token stale. O mapa no JWT seria otimização
prematura — só se houver medição de lentidão. Não é pergunta de produto.

## 4. O que o 2A NÃO muda

- Guard 1A (FINANCE_ROLES em saldo) — já em produção, mantém-se.
- Destruição de eventos (só superadmin global).
- Gestão de utilizadores (só superadmin global).
- `GET /users/me`, o próprio saldo/histórico do client.
- Crons, ecrã público.

## 5. Critérios de aceitação (para os testes)

1. `organizer` global, event-role `client` no evento X → 403 em
   `GET /events/:x/members`, `reports/*`, `users/*` (versionar para X).
2. `organizer` global, event-role `bar` no evento X → pode KDS; 403 ao
   consumir/cancelar saldo (1A mantém-se); 403 em reports/users.
3. `client` global, event-role `cashier` no evento X → pode
   `by-access-code` e criar ordem; NÃO pode em evento Y (sem membership).
4. `superadmin` global com event-role `client` → continua superadmin em tudo.
4b. `superadmin` global com event-role `bar` → continua superadmin em tudo
    (confirma que é a global `superadmin` que escapa, não uma event-role
    específica).
5. Mesma pessoa em dois eventos com roles diferentes → comporta-se conforme a
   role de cada evento.

## 6. Plano de verificação manual (produção, depois do deploy)

O mesmo ritual do 1A: verificar no ecrã real, não só nos testes unitários.

1. **Elevação por evento**: cria/promove o utilizador A (global `client`) a
   `cashier` no Magusto (via `POST /events/:id/members` ou PATCH). Faz login
   como A → deve conseguir `GET /users/by-access-code/:code` no Magusto
   (câmara QR do caixa) e 403 num evento onde não é membro.
2. **Rebaixa por evento**: rebaixa o utilizador B (global `organizer`) a
   `client` no Magusto. Faz login como B → 403 em
   `GET /events/:id/members`, `reports/*`, `users/*` do Magusto; consegue ver
   `GET /orders/mine` e carregar o próprio saldo (ação de cliente).
3. **Superadmin imune**: `superadmin` global com event-role `client` (ou bar)
   no Magusto → continua a aceder a tudo, sem se adicionar como membro
   (bypass, D-2b).
4. **Instantaneidade (sem cache)**: com A logado como `cashier` no Magusto,
   rebaixa-o para `client` e repete o pedido do passo 1 → 403 **imediatamente,
   sem re-login**. Confirma que a event-role é lida da BD a cada request
   (D-3), não do token.
5. **D-2 (se aprovado)**: com um utilizador `bar` (global ou event-role) no
   Magusto → 403 em `reports/*` e `users/*`; `GET /kitchen/stats` continua a
   funcionar (cobertura operacional confirmada).
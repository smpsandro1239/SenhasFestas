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

## Registo

- Data da execução:
- Executado por:
- Ambiente (URL API / UI):
- Resumo: Bloco 1 — passou __ / falhou __ / não testável __; Bloco 2 — passou __ / falhou __ / não testável __
- Notas (URLs, capturas, mensagens de erro inesperadas):
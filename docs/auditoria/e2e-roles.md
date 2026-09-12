# Evidências E2E por role — SenhasFestas

Gerado: 2026-09-12T20:41:27.998Z

| Role | Critério | Resultado | Detalhe |
| --- | --- | --- | --- |
| superadmin | login-ok | ✅ | status=200 |
| superadmin | no-password | ✅ | status=200 |
| superadmin | events | ✅ | status=200, n=1 |
| superadmin | orders-paginado | ✅ | status=200 |
| superadmin | audit | ✅ | status=200 |
| superadmin | audit-export | ✅ | status=200 |
| superadmin | reports-export | ✅ | status=200 |
| superadmin | users | ✅ | status=200 |
| superadmin | load-saldo | ✅ | status=201 |
| superadmin | estorno-saldo | ✅ | status=201 |
| superadmin | criar-pedido | ✅ | status=404 |
| superadmin | cancelar-pedido | ✅ | status=404 |
| superadmin | settings | ✅ | status=200 |
| organizer | login-ok | ✅ | status=200 |
| organizer | no-password | ✅ | status=200 |
| organizer | events | ✅ | status=200, n=1 |
| organizer | orders-paginado | ✅ | status=200 |
| organizer | audit | ✅ | status=200 |
| organizer | audit-export | ✅ | status=200 |
| organizer | reports-export | ✅ | status=200 |
| organizer | users | ✅ | status=200 |
| organizer | load-saldo | ✅ | status=201 |
| organizer | estorno-saldo | ✅ | status=201 |
| organizer | criar-pedido | ✅ | status=404 |
| organizer | cancelar-pedido | ✅ | status=404 |
| organizer | settings | ✅ | status=200 |
| cashier | login-ok | ✅ | status=200 |
| cashier | no-password | ✅ | status=200 |
| cashier | events | ✅ | status=200, n=1 |
| cashier | orders-paginado | ✅ | status=200 |
| cashier | audit | ✅ | status=403 |
| cashier | audit-export | ✅ | status=403 |
| cashier | reports-export | ✅ | status=200 |
| cashier | users | ✅ | status=200 |
| cashier | load-saldo | ✅ | status=201 |
| cashier | estorno-saldo | ✅ | status=201 |
| cashier | criar-pedido | ✅ | status=404 |
| cashier | cancelar-pedido | ✅ | status=404 |
| cashier | settings | ✅ | status=200 |
| bar | login-ok | ✅ | status=200 |
| bar | no-password | ✅ | status=200 |
| bar | events | ✅ | status=200, n=1 |
| bar | orders-paginado | ✅ | status=200 |
| bar | audit | ✅ | status=403 |
| bar | audit-export | ✅ | status=403 |
| bar | reports-export | ✅ | status=200 |
| bar | users | ✅ | status=200 |
| bar | load-saldo | ✅ | status=403 |
| bar | criar-pedido | ✅ | status=403 |
| bar | cancelar-pedido | ✅ | status=403 |
| bar | settings | ✅ | status=200 |
| kitchen | login-ok | ✅ | status=200 |
| kitchen | no-password | ✅ | status=200 |
| kitchen | events | ✅ | status=200, n=1 |
| kitchen | orders-paginado | ✅ | status=200 |
| kitchen | audit | ✅ | status=403 |
| kitchen | audit-export | ✅ | status=403 |
| kitchen | reports-export | ✅ | status=200 |
| kitchen | users | ✅ | status=200 |
| kitchen | load-saldo | ✅ | status=403 |
| kitchen | criar-pedido | ✅ | status=403 |
| kitchen | cancelar-pedido | ✅ | status=403 |
| kitchen | settings | ✅ | status=200 |
| treasurer | login-ok | ✅ | status=200 |
| treasurer | no-password | ✅ | status=200 |
| treasurer | events | ✅ | status=200, n=1 |
| treasurer | orders-paginado | ✅ | status=200 |
| treasurer | audit | ✅ | status=200 |
| treasurer | audit-export | ✅ | status=200 |
| treasurer | reports-export | ✅ | status=200 |
| treasurer | users | ✅ | status=200 |
| treasurer | load-saldo | ✅ | status=201 |
| treasurer | estorno-saldo | ✅ | status=201 |
| treasurer | criar-pedido | ✅ | status=404 |
| treasurer | cancelar-pedido | ✅ | status=404 |
| treasurer | settings | ✅ | status=200 |
| client | login-ok | ✅ | status=200 |
| client | no-password | ✅ | status=200 |
| client | events | ✅ | status=200, n=1 |
| client | orders-paginado | ✅ | status=200 |
| client | audit | ✅ | status=403 |
| client | audit-export | ✅ | status=403 |
| client | reports-export | ✅ | status=403 |
| client | users | ✅ | status=403 |
| client | load-saldo | ✅ | sem alvo/evento (skipped) |
| client | criar-pedido | ✅ | status=404 |
| client | cancelar-pedido | ✅ | status=404 |
| client | settings | ✅ | status=200 |

## Resumo por role

| Role | ✅ | ❌ |
| --- | --- | --- |
| superadmin | 13 | 0 |
| organizer | 13 | 0 |
| cashier | 13 | 0 |
| bar | 12 | 0 |
| kitchen | 12 | 0 |
| treasurer | 13 | 0 |
| client | 12 | 0 |

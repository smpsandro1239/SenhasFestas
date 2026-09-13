# Evidências E2E funcional — SenhasFestas

API: https://senhasfestas-api.vercel.app/api
Gerado: 2026-09-13T08:43:07.148Z

| Role | Critério | Resultado | Detalhe |
| --- | --- | --- | --- |
| superadmin | login | ✅ | ok |
| organizer | login | ✅ | ok |
| cashier | login | ✅ | ok |
| bar | login | ✅ | ok |
| kitchen | login | ✅ | ok |
| treasurer | login | ✅ | ok |
| client | login | ✅ | ok |
| auth | login-gera-refreshToken | ✅ | ok |
| setup | evento-disponivel | ✅ | status=200 |
| setup | menu-visivel-para-client | ✅ | status=200 |
| setup | produto-para-fluxo | ✅ | price=3.5 |
| setup | membros-resolvidos | ✅ | ids apanhados |
| client | accessCode-6-digitos | ✅ | code=295393 |
| cashier | carregar-saldo | ✅ | status=201 |
| kitchen | nao-pode-carregar-saldo | ✅ | status=403 |
| cashier | descontar-saldo | ✅ | status=201 |
| client | nao-pode-descontar | ✅ | status=403 |
| bar | nao-pode-descontar | ✅ | status=403 |
| cashier | saldo-descontado-correcto | ✅ | esperado=17.50 obtido=17.50 |
| client | movimento-desconto-registado | ✅ | amount=0.50 |
| cashier | encontrar-cliente-por-codigo | ✅ | status=200 |
| publico | sem-accessCode-em-api-publica | ✅ | status=200 |
| client | compra-com-saldo-sem-500 | ✅ | status=201  |
| client | nao-pode-avancar-estado | ✅ | status=403 |
| kitchen | iniciar-preparacao | ✅ | status=200 |
| bar | marcar-pronto | ✅ | status=200 |
| cashier | marcar-entregue(sem-500) | ✅ | status=200  |
| client | consumo-debitado-e-registado | ✅ | amount=3.50 |
| cashier | re-carregar-para-cancelamento | ✅ | status=201 |
| client | criar-2o-pedido | ✅ | status=201 |
| client | cancelar-reembolsa-saldo | ✅ | status=201  |
| client | reembolso-quantia-certa | ✅ | esperado=19.00 obtido=19.00 |
| client | movimento-refund-registado | ✅ | amount=3.50 |
| organizer | estornar-carregamento | ✅ | status=201 |
| client | carregamento-assinalado-estornado | ✅ | reversed=true |
| cashier | abrir-caixa | ✅ | status=201 |
| cashier | fechar-caixa | ✅ | status=201 |
| kitchen | nao-pode-abrir-caixa | ✅ | status=403 |
| organizer | criar-produto | ✅ | status=201 |
| organizer | editar-produto | ✅ | status=200 |
| organizer | apagar-produto | ✅ | status=200 |
| client | nao-pode-editar-produto | ✅ | status=403 |
| organizer | guardar-settings | ✅ | settings=200 patch=200 |
| superadmin | criar-utilizador | ✅ | status=201 |
| superadmin | apagar-utilizador | ✅ | status=200 |
| superadmin | exportar-auditoria | ✅ | status=200 |
| organizer | criar-utilizador | ✅ | status=201 |
| treasurer | carregar-saldo | ✅ | status=201 |
| treasurer | descontar-saldo | ✅ | status=201 |
| treasurer | ver-auditoria | ✅ | status=200 |
| treasurer | ver-catalogo | ✅ | status=200 |
| auth | refresh-token | ✅ | status=200 |
| auth | logout | ✅ | status=200 |
| client | registar-self-service-com-accessCode | ✅ | status=201 |
| client | orders-mine | ✅ | status=200 |
| client | historico-movimentos | ✅ | status=200 |
| cashier | user-por-id | ✅ | status=200 |
| cashier | orders-por-evento | ✅ | status=200 |
| cashier | relatorio-ordens | ✅ | status=200 |
| cashier | relatorio-saldo | ✅ | status=200 |
| cashier | relatorio-top-products | ✅ | status=200 |
| treasurer | relatorio-estatisticas | ✅ | status=200 |
| cashier | criar-pedido-como-staff | ✅ | status=201 |
| cashier | cancelar-pedido-staff-reembolsa | ✅ | status=201  |
| cashier | reembolso-staff-quantia-certa | ✅ | esperado=14.00 obtido=14.00 |
| cashier | movimento-refund-staff | ✅ | amount=3.50 |
| kitchen | marcar-entregue-como-kitchen | ✅ | status=200  |
| kitchen | nao-pode-gerir-produtos | ✅ | status=403 |
| cashier | nao-pode-gerir-produtos | ✅ | status=403 |
| bar | nao-pode-gerir-membros | ✅ | status=403 |
| organizer | listar-membros | ✅ | status=200 |
| organizer | adicionar-membro | ✅ | status=201 |
| organizer | membro-aparece-na-lista | ✅ | status=200 |
| organizer | remover-membro | ✅ | status=200 |
| superadmin | mudar-role-utilizador | ✅ | status=200 |
| organizer | nao-pode-mudar-role | ✅ | status=403 |
| publico | evento-publico | ✅ | status=200 |
| publico | pedidos-prontos-publico | ✅ | status=200 |
| publico | pedidos-preparacao-publico | ✅ | status=200 |
| publico | contagem-publico | ✅ | status=200 |
| organizer | nao-pode-apagar-evento-superadmin-so | ✅ | status=403 |

## Resumo por role

| Role | ✅ | ❌ |
| --- | --- | --- |
| superadmin | 5 | 0 |
| organizer | 13 | 0 |
| cashier | 19 | 0 |
| bar | 4 | 0 |
| kitchen | 6 | 0 |
| treasurer | 6 | 0 |
| client | 16 | 0 |
| auth | 3 | 0 |
| setup | 4 | 0 |
| publico | 5 | 0 |


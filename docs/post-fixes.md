# Análise pós-fixes — estado final e dívida aceite

Data: 2026-09-30. Âmbito: 16 itens da auditoria de segurança, todos em
produção. Este documento não contem código.

## 1. Fixes fechados

| SHA | Commit | O que resolve |
|---|---|---|
| `d7d00d9` | `fix(cash-closure): unicidade de caixa aberta + fecho por superadmin (A9)` | Uma caixa aberta por evento (409 + índice único parcial); superadmin pode fechar a caixa de outro operador; `closedById` novo; abertura e fecho passam a gerar audit |
| `f6d955b` | `fix(public): nao expor total e notes no ecra publico (A7)` | `total` e `notes` removidos dos 3 endpoints públicos sem auth — o ecrã nunca os usava |
| `a4feb0f` | `fix(cors): fechar allowlist e remover confiança no Host (A6)` | Open redirect via `Host` header: só redireciona para hosts confiáveis; CORS passa de string para array explícito |
| `06a4409` | `chore(realtime): remover emissões de saldo no canal de pedidos (A4)` | `balance_updated` emitido com o UUID do saldo como se fosse um pedido — evento inútil e enganador |
| `35b1fb9` | `fix(realtime): tratar error pós-conexão e reconexão infinita (fecho A10)` | `error` pós-ligação deixava o estado "ligado" mentiroso; 3 tentativas davam cabo de quedas de 2 min |
| `d601df9` | `fix(realtime): WS re-autentica em reconexão e expõe erros ao utilizador` | Token capturado no mount + reconexão sempre com token velho; estado de ligação invisível na UI |
| `ef765c8` | `fix(redis): tornar INCR+EXPIRE atómico (rate limit sem TTL órfão)` | 3 pares `INCR`+`EXPIRE` não atómicos: uma queda entre os dois deixava a chave sem TTL, sem limite de tentativas |
| `8b887e5` | `fix(order): validar produto ativo, evento correto e stock no create` | Criar pedido aceitava produto de outro evento, produto inativo e stock negativo |
| `cb31713` | `fix(user): accessCode não enumerável por listagem ou prefix search` | `accessCode` exposto em listagens de utilizadores e pesquisável por prefixo — permitia enumerar códigos de acesso |
| `4d624fb` | `fix(export): sanitizar células CSV contra injeção de fórmula` | CSV de vendas escrevível por quem abre no Excel (`=`, `+`, `-`, `@`) |
| `073e498` | `fix(kitchen): ordenar KDS por mais recente e remover corte a 20` | KDS cortava a 20 pedidos (pedidos antigos escondiam os novos) |
| `afbc7b3` | `fix(test): separar unit de e2e — npm test deixa de tocar na DB` | `npm test` corria e2e contra a base de dados |
| `316ee15` | `fix(reports): vendas aceita from/to e mostra erro em vez de lista vazia` | Filtro de datas inválido devolvia "sem vendas" em vez de erro — leitura silenciosa de dados errados |
| `c5459d4` | `feat(auth): event-role como teto dentro do evento (2A)` | Role global podia dar mais permissões dentro do evento do que a role de evento permitia |
| `2989a23` | `fix(auth): reports e users restritos a FINANCE_ROLES (D-2)` | Relatórios e gestão de utilizadores acessíveis a roles sem permissão financeira |
| `8056205` + `a438592` + `49dbbd3` | `fix(kitchen)` / `fix(order)` / `refactor(order): extrair reembolso para helper partilhado` | Cancelar pedido pela cozinha não reembolsava o saldo (B1) |
| `55f3880` + `03995e7` | `fix(auth): só FINANCE_ROLES mexe em saldo (B2)` + `test(order)` | Saldo manipulável por roles sem permissão; cliente podia ler saldo de outro utilizador |

**Total: 16 itens** (o fecho falava em 15 — a lista tem 16: B1, B2, B6, 2A,
D-2, B5, A12, A5, A1, A8, A3, A10, A4, A6, A7, A9).

Estado no fecho: backend **161 testes** a passar, frontend **9 testes**,
`tsc --noEmit` limpo em ambos (backend `strict: false`, frontend `strict: true`).

## 2. Dívida aceite

Decidido durante o trabalho, registado no código. Não é bug — é escolha
consciente com o custo escrito ao lado.

| Dívida | Onde | Porquê ficou |
|---|---|---|
| `motivo.includes('terminou')` para detetar evento terminado | `backend/src/common/event-window.ts:61` (NOTE `a8bc425`) | Funciona, mas é frágil a reformulações da mensagem. Rever quando o texto for estabilizado |
| Membership consultada por request, sem cache | `backend/src/common/membership.service.ts:45-46` | Freshness da membership > custo. O caminho para cache (curto, com invalidação no endpoint) está escrito na nota |
| Sem testes de integração com Postgres real | Docker ausente no ambiente | Cobre 3 coisas que unit tests não provam: concorrência de refund, atomicidade `INCR`+`EXPIRE` no Redis, e o índice único de cash-closure. A concorrência de refund foi substituída por **nota honesta** em vez de teste falso (`f67ac5d`) |
| `admin/page.tsx` com 1550 linhas | `frontend/src/app/admin/page.tsx` | Funciona. Um único ficheiro com utilizadores, produtos, eventos, configuração e auditoria. Dividir é fase 3 |
| Backend com `strict: false` e ~461 ocorrências de `any` | `backend/tsconfig.json:16` | Frontend é `strict: true`; backend nunca foi endurecido. Ativar de uma vez é um PR grande |

## 3. Pendente estrutural na BD de produção

### 3.1 A migração A9 pode ter inventado saldos — VERIFICAR

A migração `1789900000000-CashClosureUniqueness`, para conseguir criar o índice
único `(eventId) WHERE status='open'`, **fechou automaticamente** quaisquer
caixas duplicadas que existissem, gravando `closingBalance = 0`.

`0` no schema significa **"zero euros"**, não "desconhecido". Quem ler uma dessas
caixas daqui a uns meses vê um saldo inventado. As `notes` explicam a origem, mas
o campo numérico mente.

Não foi possível verificar os dados de produção antes do deploy (sem acesso à
base de dados), por isso a migração foi escrita para tratar o caso em vez de o
ignorar. A decisão de fechar foi do agente; não era reversível sem humano.

**Query de verificação** (roda no Postgres de produção):

```sql
SELECT id, "eventId", "openedAt", "closedAt", "closingBalance", notes
FROM cash_closures
WHERE notes LIKE '%[A9]%'
ORDER BY "openedAt" DESC;
```

- **0 linhas** → não havia duplicados, a migração não tocou em dinheiro real.
  Não há nada a reconciliar.
- **≥1 linha** → havia caixas duplicadas abertas. Cada uma precisa de
  reconciliação manual: fechar com o saldo real, ou, se a festa ainda não
  terminou, decidir o que fazer com cada uma.

Se houver linhas, a acção correcta **não** é corrigir o `0` por uma estimativa —
é reconstruir o saldo real a partir do dinheiro contado e das entradas da caixa,
e fechar com esse valor.

Para o futuro, a versão honesta desta migração seria `closingBalance = NULL`
("não registado") em vez de `0`, ou — melhor — **falhar a migração** e obrigar
a resolver à mão. Fechar dinheiro real às cegas não deve ser automático.

### 3.2 Chaves Redis do A4

`order:status:<balanceId>` ficaram poluídas no Redis. TTL de 24h
(`ORDER_STATUS_CACHE_TTL`), expiram sozinhas. **Sem acção** — registado apenas
para não ser investigated de novo.

## 4. Fase 3 (opcional — só com decisão do utilizador)

Nada disto é necessário para o sistema funcionar. É dívida com custo conhecido.

| Item | Custo | Benefício |
|---|---|---|
| Dividir `admin/page.tsx` (1550 linhas) em módulos: utilizadores, produtos, eventos, configuração, auditoria | Médio | Manutenção e testes por área |
| `strict: true` no backend + remover os ~461 `any` | Alto, PR grande | Apanha bugs de tipo antes de runtime. Frontend já está assim |
| `crypto.randomInt` em vez de `Math.random` no `accessCode` (`backend/src/common/access-code.ts:4` e migração `1789800000000`) | Baixo | `Math.random` não é criptográfico. O `accessCode` é um PIN de 6 dígitos, não um segredo — mas o custo de corrigir é quase zero |
| Testes de integração com Docker | Baixo de escrever, médio de manter | Fecha as 3 lacunas da secção 2 |
| Auditoria WCAG 2.1.1 / 4.1.2 em `/caixa`, `/qr-order`, `/admin` | Médio | Acessibilidade das três telas mais críticas |
| Cache de membership | Só se houver medição de latência | Performance. **Não fazer sem medição** |

## 5. Pendente de decisão do utilizador (não verificado por inferência)

| Item | Pergunta | Estado |
|---|---|---|
| **A11-0** | **Segredos de JWT e de BD em texto claro num repositório público** (`docs/vercel-deploy.md`, desde `9612b40`) | **Por fazer — urgente.** Runbook em `docs/a11-rotation.md` |
| A11 | `JWT_SECRET` aparece nas env vars do frontend `senhas-festas` no Vercel? | **Respondido: e suposto estar.** O `middleware.ts` valida o cookie no servidor; sem a variável as páginas deixam de se proteger. Não remover |
| Bloco 1 | Matriz 1A em produção: bar dá 403, cashier passa | **Por executar** |
| Bloco 2 | Matriz 2A em produção, passo 4 (promoção de event-role com sessão aberta) | **Por executar** |
| B7 | IVA 6% — aplicar ou remover da UI? Recomendação: **remover** (a UI promete o que o código nunca fez) | **Por decidir** |
| A2 | Redis em falha — bloquear logins ou permitir? Recomendação: **bloquear** (indisponibilidade curta vs risco de brute-force) | **Por decidir** |

## 6. Nota de método

A auditoria original foi um **bom mapa de risco**, não uma lista exaustiva.
Em **7 rondas consecutivas**, o código real mostrou mais nuance do que o
relatório dizia:

- **A3** — a auditoria apontava 2 pares `INCR`+`EXPIRE`; eram 3.
- **A4** — a auditoria não mencionava a poluição de cache; a investigação
  encontrou-a, e verificou que as chaves expiravam sozinhas.
- **A6** — a auditoria apontava 1 ponto (o redirect); o `Host` entrava em 2
  sítios, e o CORS tinha uma inconsistência de parsing.
- **A7** — o inventário dava o `PATCH /public/pedidos/:id/entregue` como
  desprotegido; já estava autenticado com `AuthGuard` + `RolesGuard`.
- **A9** — a auditoria tratava a ambiguidade de `obterCaixaAberta`; a
  investigação encontrou também `closedById` inexistente, `AuditModule` não
  importado (abertura e fecho sem audit) e caixas duplicadas como
  sub-problema de dados.

**Recomendação:** qualquer trabalho futuro neste projeto passa por
investigação antes de fix. Especificar o fix a partir do relatório de auditoria
teria produzido 3 correções erradas nestas rondas (A7, A9, e o tratamento de
`total`/`notes` que só fazia sentido depois de ver o que o ecrã renderiza).

O que **não** funcionou nesta ronda final: decidir sozinho como tratar dinheiro
real sem ver os dados. A fronteira do "investigação antes de codar" é: quando
a correção envolve **decidir sobre dados existentes**, o agente tem de parar e
perguntar. A migração A9 devia ter falhado em vez de fechar caixas com `0`.

## 7. Dívida registada

- **`25b1aa7` tem churn de line endings** em 3 ficheiros
  (`order-refund.ts`, `kitchen.service.ts`, `order.service.ts`):
  `git show --stat` mostra 417/415 mas o diff real é ~6/4
  (`git show --stat --ignore-cr-at-eol 25b1aa7`). Renormalizar quando
  algum destes ficheiros for voltar a tocar — não tentar reescrever o
  histórico.
- **`.gitattributes` com `text=auto eol=lf` não está a ser respeitado**
  nesses 3 ficheiros — provavelmente porque são pré-`.gitattributes`.
  Verificar quando forem renormalizados.
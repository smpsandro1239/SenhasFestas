# Checklist de fecho — 7 itens, ~25 minutos

Estado do projeto: 16 fixes da auditoria em produção, 161 testes backend,
9 frontend, `tsc` limpo nos dois. Fila de fixes **vazia**.

Este ficheiro consolida tudo o que falta, para não ter de procurar no
`test-kit.md`, no `post-fixes.md` ou no histórico de conversa.

---

## 0. A11-0 — segredos em texto claro no repositório público — PRIORIDADE

**Isto apareceu durante a preparação deste checklist e é mais grave que o A11
original.** Não é opcional e não depende de nenhuma resposta tua.

`docs/vercel-deploy.md` está versionado num repositório **público** e contém
o segredo de assinatura JWT (linha 31) e a `DATABASE_URL` com a palavra-passe
do owner (linha 40). Desde o commit `9612b40`.

**O que fazer (ordem importa):**

1. **Rodar `DATABASE_URL` primeiro** (consola Neon → nova password). Dá acesso
   directo à base de dados de produção.
2. **Depois rodar `JWT_SECRET`** nos dois projetos Vercel (`senhasfestas-api` e
   `senhas-festas`, valor igual nos dois).
3. Correr o runbook: **`docs/a11-rotation.md`**.

**Sobre o A11 original:** o `JWT_SECRET` **deve** estar no frontend — o
`middleware.ts` valida o cookie `sf_token` no servidor e sem ele as páginas
deixam de se proteger. Não o remova. A resposta a "aparece no frontend?" é
"aparece, e é suposto".

---

## 1. Migração A9 — verificar se fechou caixas com saldo inventado

**Onde:** consola Postgres de produção (Neon).

```sql
SELECT id, "eventId", "openedAt", "closedAt", "closingBalance", notes
FROM cash_closures
WHERE notes LIKE '%[A9]%'
ORDER BY "openedAt" DESC;
```

> **Atenção ao padrão.** A migração `1789900000000` escreve a nota
> `' [A9] Fechada automaticamente: ...'` — **não** contém a palavra
> "migração". Uma query `notes LIKE '%migração%'` devolve sempre 0 linhas e
> diria "não aconteceu nada" mesmo quando aconteceu. Use `'%[A9]%'`.

**Resultados possíveis:**

| Resultado | Significado | Acção |
|---|---|---|
| **0 linhas** | Não havia caixas duplicadas; a migração não tocou em dinheiro | Nada a fazer. Fechar |
| **≥1 linha** | Havia caixas duplicadas abertas; foram fechadas com `closingBalance = 0` (que no schema significa "zero euros", **não** "desconhecido") | Enviar os IDs. Reconciliar: fechar com o saldo real reconstruído, não estimar |

---

## 2. Bloco 1 — matriz 1A em produção (5 min)

**Onde:** `docs/test-kit.md`, secção "Bloco 1".

O que valida: a bar não mexe em coisas de cozinha; o cashier passa.

**Como reportar:** o HTTP status de cada passo que falhar, mais a mensagem de
erro. **Sem tokens, sem cookies.**

**Se falhar:** o agente investiga com o output. Não é adivinhação.

---

## 3. Bloco 2 — matriz 2A em produção (5 min)

**Onde:** `docs/test-kit.md`, secção "Bloco 2".

O passo 4 é o crítico: **promoção de event-role com sessão já aberta.** É onde
um cache mal feito no guard se denuncia. O resto da matriz passa com o cache
errado.

**Se falhar no passo 4:** quase certamente cache no `roles.guard.ts` ou erro
no cálculo de `roleEfetiva`. O `membership.service.ts` consulta sem cache de
propósito (`membership.service.ts:45-46`), por isso um cache não deve existir
ali — se apareceu, foi introduzido sem o registo.

---

## 4. B7 — IVA 6%: aplicar ou remover da UI (1 palavra)

| Decisão | O que acontece |
|---|---|
| **Remover da UI** | A interface deixa de prometer algo que o código nunca fez. Nada mais a fazer. **Recomendado** |
| **Aplicar** | Ronda pequena: `taxRate` em `getOrderTotal` + testes + migração de IVA em pedidos existentes (ou só futuros — é decisão tua) |

---

## 5. A2 — Redis em falha: bloquear ou permitir logins (1 palavra)

| Decisão | O que acontece |
|---|---|
| **Bloquear (fail-closed)** | Se o Redis não responde, o login é recusado em vez de passar sem rate limit. Janela curta de indisponibilidade vs. risco de brute-force. **Recomendado** |
| **Permitir (fail-open)** | Ronda de documentação: regista a decisão e o risco no código + testes do comportamento actual |

---

## 6. Fase 3 (opcional — só se disseres "quero continuar")

Nada disto é urgente. Está priorizado em `docs/post-fixes.md`.

| Item | Custo |
|---|---|
| Dividir `admin/page.tsx` (1550 linhas) | Médio — maior risco de manutenção do projecto |
| `strict: true` no backend (461 `any` hoje) | Alto, PR grande |
| Testes de integração com Postgres real (quando houver Docker) | Médio |
| `crypto.randomInt` no `accessCode` | Baixo |
| JWT assimétrico (RS256) — elimina a classe de problema do A11-0 | Alto |
| Auditoria WCAG em `/caixa`, `/qr-order`, `/admin` | Médio |

---

## Registo

Preencher à medida que executas.

| # | Item | Resultado | Data | Notas |
|---|---|---|---|---|
| 0 | A11-0 (rodar segredos) | ☐ por fazer | | |
| 1 | Migração A9 — query | ☐ 0 linhas / ☐ ≥1 linha | | |
| 2 | Bloco 1 (1A) | ☐ passou / ☐ falhou / ☐ não testável | | |
| 3 | Bloco 2 (2A, passo 4) | ☐ passou / ☐ falhou / ☐ não testável | | |
| 4 | B7 (IVA) | ☐ aplicar / ☐ remover | | |
| 5 | A2 (Redis) | ☐ bloquear / ☐ permitir | | |

**Data:** _______
**Executado por:** _______

**Notas / erros inesperados:**
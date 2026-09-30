# Checklist de fecho — 7 itens, ~25 minutos

Estado do projeto: 16 fixes da auditoria em produção, 161 testes backend,
9 frontend, `tsc` limpo nos dois. Fila de fixes **vazia**.

Este ficheiro consolida tudo o que falta, para não ter de procurar no
`test-kit.md`, no `post-fixes.md` ou no histórico de conversa.

**Migração de runtime pronta, não pusheada:** `5a98d15` (Node.js 24) e
`f439dae` (Postgres 18, Redis 8). `main` está 2 commits à frente de
`origin/main`. Secção 6.

---

## 0. A11-0 — segredos em texto claro no repositório público — PRIORIDADE

**Isto apareceu durante a preparação deste checklist e é mais grave que o A11
original.** Não é opcional e não depende de nenhuma resposta tua.

`docs/vercel-deploy.md` está versionado num repositório **público** e contém
o segredo de assinatura JWT (linha 31) e a `DATABASE_URL` com a palavra-passe
do owner (linha 40). Desde o commit `9612b40`.

**O que fazer (ordem importa):**

1. **Rodar `DATABASE_URL` primeiro** (consola Neon → role novo). Dá acesso
   directo à base de dados de produção.
2. **Depois `JWT_SECRET`** nos dois projetos Vercel (`senhasfestas-api` e
   `senhas-festas`, valor igual nos dois).
3. **Depois `CRON_SECRET`** — só existe no backend, mas estava no mesmo
   ficheiro comprometido e **não estava na tua lista original**.
4. Correr o runbook: **`docs/a11-rotation.md`**.

### Fecho da rotação (os dois passos que fecham o ciclo)

Sem estes, a rotação pode deixar o sistema num estado incoerente que só se
descobre quando algo falha:

1. **Confirmar que o `JWT_SECRET` do frontend é o mesmo valor do backend.**
   É a falha mais provável e a mais silenciosa: valores diferentes → **401 em
   tudo**, e a tendência natural é culpar o código. Confirmar por hash, nunca
   a escrever em lado nenhum. Depois: login real e confirmar que `/caixa`,
   `/cozinha` e `/pedidos` respondem 200 (não 307).
2. **Se o `CRON_SECRET` foi rodado, confirmar que o cron continua a funcionar.**
   O segredo é rotacionado nos dois lados (Vercel + valor esperado) ou o
   fecho automático de eventos deixa de correr em silêncio:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     -H "Authorization: Bearer <novo-segredo-cron>" \
     https://senhasfestas-api.vercel.app/api/cron/close-events   # 200, nao 403
   ```

**Porquê o passo 2 importa:** `vercel.json` agenda o cron e a Vercel envia o
`CRON_SECRET` automaticamente. Se só se muda na Vercel e o valor esperado no
servidor divergir, o `403` é o único sinal — e só aparece quando um evento
deveria ter fechado e não fechou.

**Já feito por mim:** o `docs/vercel-deploy.md` foi sanitizado (placeholders em
vez dos valores, o documento mantém o valor operacional). Isto foi feito
**antes** da rotação, ao contrário da ordem original — cada hora que os
segredos ficam no repositório público é exposição real, e sanitizar não
impede a rotação. **A rotação continua a ser necessária e continua tua.**

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

## 6. Push da migração de runtime — depois da rotação

**Porquê existe esta secção.** Dois commits estão commitados localmente e não
pusheados. Nenhum foi executado na prática: as tags novas do CI nunca correram,
e o volume local do Postgres nunca foi testado (não há Docker na máquina onde
isto foi preparado). **O primeiro push é o primeiro smoke test real.**

| # | Item | Onde | Onde está o procedimento |
|---|---|---|---|
| 6.1 | `DATABASE_URL` — role novo no Neon | Consola Neon → Password | `docs/a11-rotation.md` §5 |
| 6.2 | `DATABASE_URL` no backend Vercel | `senhasfestas-api` / production | `docs/a11-rotation.md` §4 |
| 6.3 | **`DB_PASSWORD` (+ `DB_HOST`/`DB_USERNAME`) nos GitHub Secrets** | GitHub → Settings → Secrets | `docs/runbook-push-node-pg.md` §1.3 |
| 6.4 | `JWT_SECRET` — **os dois** projetos, mesmo valor | `senhasfestas-api` + `senhas-festas` | `docs/a11-rotation.md` §4 |
| 6.5 | `CRON_SECRET` — backend | `senhasfestas-api` / production | `docs/runbook-push-node-pg.md` §1.5 |
| 6.6 | Volume local do Postgres (só se tiveres dados) | `docker compose` | `docs/dev-pg18-migration.md` |
| 6.7 | `git push origin main` | — | `docs/runbook-push-node-pg.md` §2 |
| 6.8 | CI verde (backend + frontend) | GitHub Actions | `docs/runbook-push-node-pg.md` §3 |
| 6.9 | Deploy verde | GitHub Actions | `docs/runbook-push-node-pg.md` §4 |
| 6.10 | `/api/health` 200 **e** um pedido real que toque na BD | produção | `docs/runbook-push-node-pg.md` §5 |
| 6.11 | Cron com o segredo novo → 200, não 403 | produção | `docs/runbook-push-node-pg.md` §5.4 |

> **6.3 não é a mesma coisa que 6.2.** O job `deploy` do CI lê `DB_PASSWORD` /
> `DB_HOST` / `DB_USERNAME` / `DB_NAME`, **não** `DATABASE_URL`
> (`.github/workflows/ci.yml`; consumido em
> `backend/src/database/data-source.ts:7-12`). Actualizar o `DATABASE_URL` nos
> GitHub Secrets não muda nada para o `migration:run`. São dois caminhos
> separados: Vercel para o backend, GitHub Secrets para o CI.

> **Ordem.** 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.7. A rotação do `DATABASE_URL`
> primeiro porque dá acesso directo aos dados e não tem dependências. O
> `JWT_SECRET` só depois, porque rotacioná-lo faz logout de toda a gente — não
> se quer isso a meio de um evento. O push no fim, porque é o que executa
> `migration:run` contra a produção.

> **O `JWT_SECRET` no frontend é suposto estar lá.** Não remova
> (`docs/a11-rotation.md` §0). Se desaparecer, `middleware.ts` trata o token
> como expirado e deixa passar todas as rotas — sem erro e sem log.

---

## 7. Fase 3 (opcional — só se disseres "quero continuar")

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
| 6.1 | Neon — `DATABASE_URL` rotado | ☐ por fazer | | |
| 6.2 | Vercel backend — `DATABASE_URL` | ☐ por fazer | | |
| 6.3 | GitHub Secrets — `DB_PASSWORD` (+ host/user) | ☐ por fazer | | |
| 6.4 | `JWT_SECRET` nos dois projetos Vercel | ☐ por fazer | | |
| 6.5 | `CRON_SECRET` no backend | ☐ por fazer | | |
| 6.6 | Volume local PG15→PG18 | ☐ limpo / ☐ dump-restore / ☐ não aplicável | | |
| 6.7 | Push | ☐ feito | | SHA: |
| 6.8 | CI verde | ☐ passou / ☐ falhou | | |
| 6.9 | Deploy verde | ☐ passou / ☐ falhou | | |
| 6.10 | `/api/health` + pedido real | ☐ 200 | | |
| 6.11 | Cron com segredo novo | ☐ 200 / ☐ 403 | | |

**Data:** _______
**Executado por:** _______

**Notas / erros inesperados:**
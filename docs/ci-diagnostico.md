# Diagnóstico: o CI nunca executou um único job

Data da investigação: 2026-10-03
Âmbito: leitura via API pública do GitHub (o repositório é público, por isso
responde sem autenticação). Comandos reproduzíveis no fim.

## Resumo

O workflow `CI` está registado e activo, mas **nunca arranca um job**. Não é
uma regressão recente: o problema é anterior a qualquer alteração desta
sessão.

| Métrica | Valor |
|---|---|
| Execuções totais | 137 |
| Execuções com sucesso | **0** |
| Jobs executados por execução | **0** |
| Commits com check runs | **0** |

O workflow foi introduzido em `9098708` ("ci: workflow com lint, testes e e2e
sobre Postgres/Redis"). Desde essa data, todas as execuções falham com zero
jobs — incluindo `8c1b98b`, `1636c6b` e `50710f5`.

## O que foi verificado

### 1. O workflow está registado e activo

`GET /actions/workflows` devolve:

```
name: .github/workflows/ci.yml | id: 351109406 | state: active
```

O ficheiro é reconhecido pelo GitHub. Não é um ficheiro ignorado ou mal
colocado.

### 2. O YAML é válido

Parsed com PyYAML sem erros:

```
jobs: ['backend', 'frontend', 'deploy']
on:   {'push': {'branches': ['main']},
       'pull_request': {'branches': ['main']},
       'workflow_dispatch': None}
```

A estrutura está correcta e os três jobs são os esperados.

### 3. Não há bloco `permissions:`

Ausente no `ci.yml`. **Não é a causa**: na ausência do bloco, o GitHub aplica
as permissões por defeito do repositório, e isso não impede o arranque de
jobs. Ainda assim, declarar `permissions:` explicitamente é boa higiene e
elimina uma variável — fica como recomendação, não como correcção.

### 4. As execuções falham antes de qualquer job

`GET /actions/runs/37049052856/jobs` → `total_count: 0`.

`GET /commits/50710f5/check-suites` → a suite `github-actions` está
`completed / failure` com `latest_check_runs_count: 0`.

Uma execução que completa como *failure* com zero check runs é a assinatura de
uma falha de **arranque** do workflow, não de um job que correu e falhou. Um
teste a falhar produziria um job com nome, passos e output.

### 5. Nunca houve check run de sucesso em nenhum commit

Verificado em `50710f5`, `8c1b98b`, `9098708` e `a8bc425`: zero check runs em
todos. Não é uma configuração que deixou de funcionar — nunca funcionou.

### 6. As outras integrações também não reportam

No mesmo commit, as suites `vercel`, `render`, `railway-app` e `netlify`
estão todas `queued` com 0 runs. Nenhuma produz check runs.

Juntas, Actions a falhar no arranque e integrações paradas em `queued` sugerem
um problema de nível de conta/repositório (autorizações das apps ou Actions
não activo), e não um problema do conteúdo do workflow.

## Causas que só podem ser confirmadas no dashboard

A API pública já não dá mais. `GET /actions/runs/{id}/logs` devolve **403
"Must have admin rights"** — os logs de arranque, que provavelmente contêm a
mensagem exacta, exigem autenticação.

### Verificar 1 — Orçamentos de minutos

`Settings` → `Billing and licensing` → `Budgets and alerts`.

O repositório é público, o que deveria dar minutos gratuitos. Mas se as
Actions estiverem a contar como privadas, ou se o limite de 2000 min/mes
estiver esgotado, as execuções falham imediatamente sem jobs — exactamente o
sintoma observado.

### Verificar 2 — Actions desactivadas no repositório

`Settings` → `Actions` → `General` → `Actions permissions`.

Se estiver em `Disable`, o GitHub continua a criar a execução, marca-a como
failure e não lança jobs. É o caso mais provável.

### Verificar 3 — Workflows desactivados

`Actions` → aba de workflows → confirmar que `CI` não está em "Disable
workflow".

### Verificar 4 — Permissões de leitura/escrita

`Settings` → `Actions` → `General` → `Workflow permissions`. Se estiver em
`Read repository contents and packages permissions`, o job `backend` falha a
`actions/checkout` — mas isso produziria um job falhado, não zero jobs.
Menor probabilidade, mas é a única destas quatro que o sintoma não explica
sozinho.

## Porquê que isto não travou o projecto

As execuções do GitHub Actions nunca foram o portão de entrada. O código tem
chegado a produção pelo auto-deploy da Vercel no push, e a validação tem sido
feita manualmente: testes locais, verificação visual da UI e leitura do
dashboard da Vercel.

Isto explica porque nenhuma ronda anterior reportou "CI verde": nunca houve
para reportar. Todas reportaram validação local — que era verdadeira, e
continua a ser o que sustenta os commits.

**Risco de fundo — perda de confiança:** validação manual não é replicável nem
obrigatória. Nada obriga a correr `npm test` antes de um push, porque nada
falha se não o corrermos.

## Comandos reproduzíveis

```bash
REPO=smpsandro1239/SenhasFestas

# 1. Estado de todas as execuções
curl -s "https://api.github.com/repos/$REPO/actions/runs?per_page=100" \
  | grep -o '"conclusion":"[a-z]*"'

# 2. Total de execuções e sucessos
curl -s "https://api.github.com/repos/$REPO/actions/runs?per_page=100" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).workflow_runs;console.log("runs:",r.length,"success:",r.filter(x=>x.conclusion==="success").length)})'

# 3. Jobs de uma execução (esperado: 0)
curl -s "https://api.github.com/repos/$REPO/actions/runs/37049052856/jobs"

# 4. Workflow registado
curl -s "https://api.github.com/repos/$REPO/actions/workflows"

# 5. Logs (exige autenticação — devolve 403 sem ela)
curl -sL "https://api.github.com/repos/$REPO/actions/runs/37049052856/logs" -o logs.zip
```

Para obter a mensagem de arranque exacta é preciso `gh auth login` com
`repo` + `workflow` e depois:

```bash
gh run view 37049052856 --log-failed
```

## Diagnóstico feito por

Agente, via API pública. A confirmação final depende de acesso ao dashboard.

## Ver também

- `docs/runbook-push-node-pg.md` — pré-condições antes de push para `main`
- `docs/e2e-setup.md` — credenciais necessárias para a suite Playwright
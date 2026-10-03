# Runbook — push dos commits de migração (Node 24, PG18, Redis 8)

Commits locais desta migração, do mais recente ao mais antigo:

| Commit | O que muda |
|---|---|
| `5a98d15` | `chore(runtime): exigir Node.js 24 LTS` — `engines`, Dockerfiles, CI, `build.vercel.mjs` |
| `f439dae` | `chore(db): subir Postgres 15→18 e Redis 7→8` — tags no CI e no compose, + montagem do volume |
| `6e24dc9` | `docs: runbook do push + migração local de PG15→18` — só documentação |
| `ca3d471` | `docs: corrigir contagem de testes frontend (9 → 21)` — só documentação |
| `50710f5` | `docs: runbook actualizado para quatro commits locais` — só documentação |

Só os dois primeiros mexem em código. Os restantes são documentação e não
afectam o deploy.

> A lista acima está inevitably desactualizada a cada commit `docs:` novo —
> incluindo este. É por isso que a pré-condição 1.1 não compara contagens:
> compara SHAs de **código**. Ver 1.1.

Objectivo deste documento: quando disseres **"rotação feita, push agora"**, a
execução é mecânica e cada passo é verificável. Nada aqui é executado pelo
agente sem a tua ordem — nem o push, nem a rotação.

> **Nenhum destes passos foi executado uma única vez.** As tags novas do CI
> (`postgres:18-alpine`, `redis:8-alpine`) nunca correram. A migração do volume
> local também não foi testada (não há Docker na máquina onde isto foi
> preparado). O primeiro push é o primeiro smoke test real.

---

## 1. Pré-condições

Verificar **todas** antes de fazer seja o que for. Se alguma falhar, parar.

### 1.1 Os commits de código são exactamente estes dois

```bash
git log origin/main..HEAD --oneline
```

A verificação **não** é a contagem de commits — essa regra quebra sempre que se
acrescenta documentação, e um runbook que obriga a editar-se a si próprio para
continuar a ser verdade não serve de nada. O que interessa é outra coisa:
**que não exista nenhum commit de código além dos dois esperados.**

Commits de **código** (qualquer prefixo que não seja `docs:`) têm de ser
exactamente:

| SHA | O que muda |
|---|---|
| `5a98d15` | `chore(runtime): exigir Node.js 24 LTS` |
| `f439dae` | `chore(db): subir Postgres 15→18 e Redis 7→8` |

Commits `docs:` adicionais são aceitáveis e não mudam o deploy — podem estar
lá tantos quantos a documentação precisar.

Para aplicar a regra:

```bash
# Deve devolver apenas 5a98d15 e f439dae.
# Se devolver outro SHA, a árvore não é a que este runbook descreve.
git log origin/main..HEAD --oneline \
  | grep -v ' docs: ' \
  | grep -vE '^[0-9a-f]+ chore\(runtime\): exigir Node\.js 24 LTS$'
```

Se o comando **não devolver nada**, a árvore está correcta: os únicos commits
não-documentação são os dois esperados. Se devolver um SHA, parar e reler.

Nota: `chore:` conta como commit de código. Só `docs:` é documental.

### 1.2 Rotação do `DATABASE_URL` (Neon)

- [ ] Password nova gerada na consola Neon
- [ ] `DATABASE_URL` actualizada no projeto Vercel `senhasfestas-api` (production)
- [ ] Backend redeployado; `GET /api/health` → 200
- [ ] Password antiga já inválida (a consola revoga ao gerar nova)

Detalhes: `docs/a11-rotation.md`, secção 5.

### 1.3 GitHub Secrets — **atenção, não é `DATABASE_URL`**

> **O job `deploy` do CI não lê `DATABASE_URL`.** Lê `DB_HOST`, `DB_PORT`,
> `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` (`.github/workflows/ci.yml`), e é isso
> que `backend/src/database/data-source.ts:7-12` consome. Actualizar
> `DATABASE_URL` nos GitHub Secrets **não muda nada** para o `migration:run`.
> O que decide é o `DB_PASSWORD` — e `DB_HOST`/`DB_USERNAME` se criares um role
> novo no Neon em vez de só trocar a password.

- [ ] `DB_PASSWORD` no repositório = password do role novo
- [ ] `DB_HOST` e `DB_USERNAME` apontando para o role novo, se aplicável
- [ ] `DB_NAME`, `DB_PORT` inalterados

```bash
gh secret list          # confirma os nomes; NUNCA imprime valores
```

Se tiveres criado um role novo com nome diferente, actualiza também
`DB_USERNAME` e `DB_HOST` — o pooler do Neon tem host próprio do direct
connection, e são eles que o CI usa.

### 1.4 Rotação do `JWT_SECRET` — nos **dois** projetos

- [ ] Backend `senhasfestas-api` / production
- [ ] Frontend `senhas-festas` / production
- [ ] **O mesmo valor nos dois** (verificação por hash, nunca escrever o valor)
- [ ] `JWT_SECRET` **mantido** no frontend — não remover (ver 5.1)
- [ ] Nenhuma `NEXT_PUBLIC_*` com esse valor
- [ ] Redeploy: backend primeiro, frontend depois

Detalhes: `docs/a11-rotation.md`, secções 0 e 4.

### 1.5 Rotação do `CRON_SECRET` (backend)

- [ ] Valor novo gerado
- [ ] `senhasfestas-api` / production
- [ ] Redeploy do backend

`vercel.json` agenda dois cron (`0 5 * * *` e `0 6 * * *`) em
`/api/cron/close-events`. A Vercel envia o `CRON_SECRET` como
`Authorization: Bearer`. O backend compara em `cron.controller.ts:36-46` com
comparação de tempo constante, e **falha fechado** se a variável não existir
(`ForbiddenException`, linha 39). Divergência entre a Vercel e o valor esperado
no servidor → `403` e o fecho automático de eventos deixa de correr **em
silêncio**.

### 1.6 Volume local do Postgres (se tiveres dados de dev)

O compose passou a `postgres:18-alpine` com o volume montado em
`/var/lib/postgresql`. Um volume com PGDATA de PG15 **não abre** no PG18, e
com a montagem nova um `docker compose up` arranca com base **vazia sem
aviso**. Procedimento: `docs/dev-pg18-migration.md`.

### 1.7 Nada a fazer com o Next.js

`next.config.ts` intacto, `next@15` intacto, React 18 intacto. A migração para
Next 16 / React 19 é uma ronda separada e não está neste push.

---

## 2. Sequência do push

```bash
git push origin main
```

Depois, no GitHub Actions:

1. Job **backend** — corre com `postgres:18-alpine` + `redis:8-alpine`
   (serviços efémeros, sem volume). Inclui lint, testes, build e E2E.
2. Job **frontend** — lint + build.
3. Job **deploy** — só corre se `secrets.DEPLOY_HOST` não estiver vazio, e
   **só se `backend` e `frontend` passarem** (`needs: [backend, frontend]`).
   Faz `npm ci` + `migration:run` contra o Postgres de produção e depois
   `git pull --ff-only` + `bash scripts/deploy.sh` por SSH.

Regras de condução:

- **CI vermelho → parar.** Investigar antes de tocar em produção. Ver secção 3.
- **Deploy vermelho → parar.** Não voltar a fazer push. Ver secção 4.
- **Deploy verde não significa sucesso.** Passa à secção 5.

> Nota: `scripts/deploy.sh` volta a correr `migration:run` (passo 3/5) depois
> de o job de CI já o ter corrido. É idempotente com TypeORM, mas se o
> primeiro foi bem-sucedido o segundo é um no-op. Se o segundo falhar depois
> do primeiro passar, é sinal de divergência entre a BD que o CI viu e a que o
> servidor viu.

---

## 3. Se o CI falhar

O sintoma mais provável deste push é o serviço novo.

1. **Que job falhou** — `backend` ou `frontend`. O `frontend` não tem serviços,
   logo se falhar é código ou Node, não PG/Redis.
2. **Se foi `backend`**, olhar para o step anterior ao que falhou:
   - `Testes e2e (Postgres + Redis)` → a causa é a imagem nova
   - `Testes unitários` / `Lint` / `Build` → não é a imagem; é o Node 24
3. **Logs do contentor de serviço.** GitHub expõe-nos no passo; para mais
   detalhe, replicar localmente:
   ```bash
   docker run --rm postgres:18-alpine postgres --version
   docker run --rm redis:8-alpine redis-server --version
   ```
4. **Suspeitas concretas para `postgres:18-alpine`:**
   - PGDATA e VOLUME mudaram de sítio (ver `docs/dev-pg18-migration.md`) — mas
     **os serviços do CI não montam volumes**, portanto em CI isto não se
     aplica. Se falhar, é outra coisa.
   - `gen_random_uuid()` — nativo desde o PG13, não precisa de `pgcrypto`. As
     migrations usam-no em todas as tabelas e não há `CREATE EXTENSION` no
     código. Não deve ser a causa.
   - Um default ouGenerated column que o PG18 passou a rejeitar — a ver no log.
5. **Suspeitas concretas para `redis:8-alpine`:**
   - O código usa apenas `get/set/sadd/publish/expire/subscribe/incr/eval/del`
     — todos suportados no 8. Não há módulos (nada de RedisJSON/Path/Bloom).
   - O cliente é `ioredis@^6`, fala RESP normalmente.
   - O upgrade 7→8 é um caminho suportado pela Redis. `/data` não muda.
6. **Não re-correr às cegas.** Um re-run que passa não explica a causa; só
   confirma que foi intermitente.

---

## 4. Se o deploy falhar no `migration:run`

Ver o log **do step específico**, não o resumo.

| Sintoma no log | Causa provável | O que fazer |
|---|---|---|
| `connection refused` / `could not connect` | O CI não recebeu credenciais válidas | `DB_PASSWORD`/`DB_HOST`/`DB_USERNAME` errados ou role novo ainda sem propagação. **Verificar os GitHub Secrets, não a Vercel** — são dois caminhos separados |
| `password authentication failed` | Password do role não corresponde à do GitHub Secret | Reenviar `DB_PASSWORD`; confirmar que a password antiga foi mesmo revogada |
| `relation "..." already exists` | Divergência de estado: migrations corridas noutro sítio (local, ou uma execução anterior parcial) | **Não** resolver com `migration:revert` às cegas. Comparar a tabela `migrations` do TypeORM na BD de produção com a lista em `backend/src/database/migrations/`. Decidir com o conteúdo antes de mexer |
| `column ... already exists` / `type ... already exists` | Mesma origem: a migration partially aplicada | Idêntico. Inspecionar a estrutura real antes de tentar seja o que for |
| timeout / `terminating connection` | Neon cold start ou pooler sobrecarregado | Re-tentar **uma** vez. Se repetir, é capacidade ou config do pooler, não sorte |
| `ECONNREFUSED` após `npm ci` | Dependência nativa não compilada no runner | Olhar para o step anterior; não tem relação com PG/Redis |

**Nunca** re-correr o deploy às cegas. Se a `migration:run` foi aplicada a
metades e o jobdied a meio, um segundo run pode encontrar um estado que não
corresponde a nenhum dos dois ramos do `if` do TypeORM. Inspecionar
`SELECT * FROM migrations ORDER BY timestamp;` primeiro.

---

## 5. Verificação pós-deploy

Não declarar sucesso sem os quatro. O primeiro é o mais fácil e o que dá
falsos verdes mais vezes.

### 5.1 Login real e páginas protegidas

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://senhasfestas-api.vercel.app/api/health   # 200
```

Depois, com sessão real: `/caixa`, `/cozinha`, `/pedidos` respondem **200**, não
**307**. Um 307 com cookie válido significa `JWT_SECRET` desalinhado entre os
dois projetos Vercel — a falha mais provável e mais silenciosa de toda a
rotação, porque a API continua a proteger os dados: só o frontend bloqueia, e
a tendência natural é culpar o código.

Regressão a vigiar: se `JWT_SECRET` desaparecer do frontend, `middleware.ts`
trata o token como expirado (linhas 31-33) e faz `NextResponse.next()`
(linha 77) — **todas as rotas passam, sem erro e sem log**. Testar os 200, não
só o login.

### 5.2 SHA do deploy = HEAD local

```bash
git rev-parse HEAD
node_modules/.bin/vercel.cmd inspect <url-do-deployment>   # comparar
```

Se o SHA do deploy não for o HEAD local, o push não foi o que chegou à
produção.

### 5.3 Um pedido real que toque na base de dados

`/api/health` pode responder 200 sem a BD estar acessível. Criar um pedido de
teste real (ou `GET /api/pedidos` autenticado) e confirmar que devolve dados.
Se a BD estiver inacessível, o erro só aparece aqui.

### 5.4 Cron com o segredo novo

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <CRON_SECRET_NOVO>" \
  https://senhasfestas-api.vercel.app/api/cron/close-events
```

**200, não 403.** Este `GET` executa mesmo o fecho de eventos expirados, por
isso confirma primeiro que não há nenhum evento em curso que possa ser fechado
por acidente.

---

## 6. Se correr mal

Não faz rollback do Node 24 por si só. O diagnostico decide:

| Sintoma | Causa | Acção |
|---|---|---|
| CI_backend vermelho no build/lint | Node 24 expôs algo que o 20 tolerava | Investigar o erro exacto; não fazer `node-version: 20` às cegas |
| Produção não arranca | Runtime Vercel | Confirmar `nodejs24.x` em `backend/build.vercel.mjs` (linha 43) e que o `.vercel/output` foi regenerado |
| `DATABASE_URL` antiga ainda a funcionar | Rotação incompleta no Neon | Concluir a rotação. **Isto não depende do push** |

Um `git revert` dos **dois commits de código** (`5a98d15` e `f439dae`) é
tecnicamente possível e deixa o `docker-compose.yml` com a montagem antiga.
**Não é o primeiro recurso** — o PG18 não é a causa provável de um deploy
partido, e reverter o compose não desfaz nada do que já foi para a Neon.

---

## Referências

- `docs/a11-rotation.md` — rotação dos três segredos, opção A e verificação
- `docs/vercel-deploy.md` — topologia Vercel, IDs dos projectos, comandos de env
- `docs/dev-pg18-migration.md` — volume local PG15→PG18
- `docs/checklist-fecho.md` — estado geral e o que falta
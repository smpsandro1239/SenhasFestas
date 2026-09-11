# Deploy Vercel — SenhasFestas (guia oficial atual)

> **IMPORTANTE — LEIA ISTO SE TROCAR DE COMPUTADOR:**
> O deploy atual vive na Vercel (não em Railway/Docker) e **correu cedo neste
> guia**. Se for trabalhar noutro computador, primeiro leia a secção
> [Checklist obrigatória ao trocar de computador](#checklist-obrigatória-ao-trocar-de-computador).
> A causa do bug "login não sai da página" era o `JWT_SECRET` **diferente** entre
> backend e frontend — tem de ser **exatamente o mesmo valor em todos os
> computadores e nos dois projetos Vercel**.

## Visão geral (estado atual — SET/2026)

- **Frontend:** https://senhas-festas-ten.vercel.app (projeto Vercel `senhas-festas`)
- **Backend (API):** https://senhasfestas-api.vercel.app (projeto Vercel `senhasfestas-api`)
- **Base de dados:** Neon Postgres (ligação via connection pooler, `sslmode=require`)
- **Backend = serverless:** Build Output API v3 — `node build.vercel.mjs` em `backend/`
  faz `nest build` (tsc preserva os decorators do TypeORM) + bundle esbuild do
  `dist/serverless.main.js` + instala `pg` dentro da função. **Não** usar o esbuild
  da Vercel diretamente (não emite `emitDecoratorMetadata` → TypeORM parte).
- **Conta Vercel:** `sandropereira` · **Team:** `smpsandro1239s-projects`

## Checklist obrigatória ao trocar de computador

1. **`JWT_SECRET` tem de ser IGUAL em todo o lado** (a causa do bug bloqueante):
   - `backend/.env` (local)
   - `frontend/.env` (local)
   - Projeto Vercel `senhasfestas-api` → env `JWT_SECRET` (produção/preview/dev)
   - Projeto Vercel `senhas-festas` → env `JWT_SECRET` (produção/preview/dev)
   - Valor atual (64 char hex):
     ```
     7eef4cee5b645eafd7d37a71d190f2ec5cb0d893a376b66e486ac4d6dcda7d3f
     ```
   - Verificação rápida: `GET /api/health` 200; `POST /api/auth/login` devolve token;
     `GET https://senhas-festas-ten.vercel.app/` **com** `Cookie: sf_token=<token>`
     responde 200 (e não 307 para login). Se o `/` der 307 mesmo com cookie válido,
     é o `JWT_SECRET` do projeto frontend Vercel que está desatualizado.

2. **`DATABASE_URL`** (Neon) no projeto `senhasfestas-api` (Vercel):
   ```
   postgresql://neondb_owner:npg_KaAMevl41ZTS@ep-little-darkness-aemyw7gu-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

3. **Variáveis publicas do frontend** (projeto `senhas-festas` na Vercel, todas as envs
   produção/preview/development):
   - `NEXT_PUBLIC_API_URL=https://senhasfestas-api.vercel.app`
   - `NEXT_PUBLIC_WS_URL=wss://senhasfestas-api.vercel.app`
   - `JWT_SECRET` (ver ponto 1)
   - `FRONTEND_URL=https://senhas-festas-ten.vercel.app` → está no **backend**
     (projeto `senhasfestas-api`).

4. **Vercel CLI instalado:** a partir da raiz `npm install --no-save vercel` →
   usar `node_modules/.bin/vercel.cmd`. Nota Windows: `npx.ps1` está bloqueado por
   ExecutionPolicy; usar `npm.cmd` (`npm install`, `npm exec ...`).

5. Após editar código: commit + push, e **redeploy de cada projeto afetado pelos
   passos das secções abaixo**.

## Identificação dos projetos Vercel (para API)

| Projeto         | ID Vercel                                      | Domínio                          |
| ---             | ---                                            | ---                              |
| `senhasfestas-api` | `prj_BpiU6pJo3pR26Qp8yZgTulbi1AwL`         | https://senhasfestas-api.vercel.app |
| `senhas-festas`    | `prj_CKMkZSvip1QDlVUAmo7OmLzVdhIE`          | https://senhas-festas-ten.vercel.app |

- `rootDirectory: frontend` fica definido no projeto Frontend — por isso o deploy do
  frontend é feito **a partir da raiz do repositório**, nunca de `frontend/`.
- `ssoProtection: null` está definido em ambos (deployments públicos sem login).

## Deploy do backend (serverless)

```bash
cd backend
node build.vercel.mjs                 # gera .vercel/output (função api/index.js.func com pg)
vercel link --yes --project senhasfestas-api   # 1ª vez
vercel deploy --prebuilt --prod --yes
```

- Não há `npm run build` neste cenário — o `build.vercel.mjs` faz tudo (nest build + esbuild).
- Verificar: `GET https://senhasfestas-api.vercel.app/api/health` → 200
  `{"status":"ok",...}`.

## Deploy do frontend

```bash
# A PARTIR DA RAIZ do repositório (rootDirectory=frontend no projeto Vercel)
vercel link --yes --project senhas-festas    # 1ª vez
vercel deploy --prod --yes
vercel alias set "<url-deployment>" senhas-festas-ten.vercel.app
```

- O alias `senhas-festas-ten.vercel.app` tem de ser re-aplicado após o deploy, porque
  o deployment novo fica com uma URL gerada até ser aliased.
- Verificar: `GET https://senhas-festas-ten.vercel.app/auth/login` → 200.

## Env vars via API (exemplo usado na manutenção)

O CLI da Vercel esconde valores (Secret). Para ler/listar/alojar envs e IDs:

```bash
AUTH=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.APPDATA+'/com.vercel.cli/Data/auth.json')).token)")
# listar envs
curl -s "https://api.vercel.com/v9/projects/prj_CKMkZSvip1QDlVUAmo7OmLzVdhIE/env?teamId=smpsandro1239s-projects" -H "Authorization: Bearer $AUTH"
# adicionar env (ex.: JWT_SECRET)
curl -s -X POST "https://api.vercel.com/v10/projects/prj_CKMkZSvip1QDlVUAmo7OmLzVdhIE/env?teamId=smpsandro1239s-projects" \
  -H "Authorization: Bearer $AUTH" -H "Content-Type: application/json" \
  -d '{"key":"JWT_SECRET","value":"7eef4cee...","type":"encrypted","target":["production","preview"]}'
# apagar env
curl -s -X DELETE "https://api.vercel.com/v9/projects/<PROJECT_ID>/env/<ENV_ID>?teamId=smpsandro1239s-projects" -H "Authorization: Bearer $AUTH"
```

## Problemas resolvidos (para não regredirem)

1. **Login "não sai da página"** — `JWT_SECRET` desalinhado entre backend e frontend
   (backend Vercel usava `7eef4cee...`, frontend local tinha `a9c93c...`). O middleware
   (`frontend/src/middleware.ts`) valida `sf_token` com o `JWT_SECRET` do **projeto
   frontend Vercel** e redirecionava tudo para `/auth/login`. **Fix:** alinhar valor em
   todos os locais (ver checklist ponto 1). Commit de referência:
   `46dc9da fix: definir cookie sf_token no login para o middleware nao bloquear navegacao`.
   (Este commit também passou a definir o cookie `sf_token` no `persistSession()` —
   antes só `localStorage`, o que também bloqueava o middleware.)

2. **PWA: "Manifest: Line 1 column 1 Syntax error"** — o middleware interceptava
   `manifest.webmanifest` e redirecionava para `/auth/login` (307 → HTML). **Fix:**
   o matcher exclui `.webmanifest` (commit `57723e1`).

3. **PWA: `FetchEvent ... network error response`** — o `sw.js` devolvia
   `Response.error()` quando a rede falhava. **Fix:** `sw.js` v3 nunca devolve
   `Response.error()`; navegações com `no-store` + fallback ao shell offline
   (commit `22ac340`).

4. **Caixa: `Failed to execute 'json' on 'Response': Unexpected end of JSON input`** —
   `GET /cash-closure/event/:id/aberta` devolve 200 com corpo vazio quando não há caixa
   aberta (`findOne` → `null`). O `request()` do frontend fazia `response.json()` e
   rebentava. **Fix:** `request()` em `frontend/src/lib/api.ts` tolera corpo vazio
   (commit `e15474a`).

5. **Deploy `DEPLOYMENT_NOT_FOUND` intermitente na API** — ocorreu ao usar o domínio
   aliased durante o deploy; resolver com été re-alias/limpeza do deploy (verificar
   com `GET /api/health`).

## Notas serverless

- **WebSocket não funciona** em Vercel serverless → usado polling (por design).
- **Rate limit / CORS:** backend valida `FRONTEND_URL` (tem de incluir o domínio real).
- O bundle da função é regenerado por `build.vercel.mjs`; se o `.vercel/output` antigo
  ficar sujo, apagar e regenerar.
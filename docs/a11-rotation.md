# Runbook A11 — rotação de segredos

> **Leia a secção 0 antes da 1.** O A11 tal como foi formulado ("o
> `JWT_SECRET` aparece no frontend?") tem a premissa errada. O problema real
> é outro, e é mais grave.

## Secção 0 — A11-0: segredos em texto claro num repositório público

### O que é

`docs/vercel-deploy.md` está versionado no git e contém, em texto claro:

| Linha | Segredo | O que permite |
|---|---|---|
| 31 | Segredo de assinatura JWT (64 hex) | Forjar um token com `role: superadmin` e contornar **toda** a autorização do sistema |
| 40 | `DATABASE_URL` do Neon, com a palavra-passe do `neondb_owner` | Ligar directamente à base de dados de produção: ler e escrever tudo |

- **Repositório:** `https://github.com/smpsandro1239/SenhasFestas` —
  `visibility: public`, confirmado via API do GitHub.
- **Desde quando:** commit `9612b40` ("docs: guia oficial de deploy Vercel...").
- **Já não vale apagar o ficheiro.** O valor está no histórico do git e num
  `clone` de qualquer pessoa. O único efeito de apagar é esconder a prova.

**Conclusão: os dois segredos têm de ser rotacionados. Não é opcional, não é
"se aparecer", e não depende de nenhuma resposta sobre o frontend.**

### Prioridade e impacto

| Segredo | Quem teve acesso | O que fazer |
|---|---|---|
| `DATABASE_URL` | Qualquer pessoa, desde `9612b40` | Rotacionar **primeiro** — dá acesso directo aos dados |
| `JWT_SECRET` | Qualquer pessoa, desde `9612b40` | Rotacionar em seguida |

Não há como determinar se foram usados. Assumir comprometidos e rodar.

### Sobre o A11 original (o frontend ter a variável)

Isto está **correcto e não é fuga**:

- `frontend/src/middleware.ts:30` corre no servidor do Next.js (Edge Runtime).
  `process.env.JWT_SECRET` sem prefixo `NEXT_PUBLIC_` **não** entra no bundle
  do browser.
- `docs/vercel-deploy.md:24-28` documenta que a variável tem de estar nos dois
  projetos — o frontend valida o cookie `sf_token` com o mesmo segredo.
- Se a desaparecer do frontend, o middleware passa a tratar o token como
  expirado (`middleware.ts:31-33`) e **qualquer página protegida deixa de
  proteger-se** — degrada para.redirect em vez de 403.

Portanto: **não remova `JWT_SECRET` do frontend.** A resposta certa a "o
`JWT_SECRET` aparece no frontend?" é "aparece, e deve aparecer".

O que vale verificar (30 segundos, opcional): que não existe nenhuma variável
`NEXT_PUBLIC_*` com o mesmo valor no frontend. Se existir, essa sim é fuga
para o browser.

---

## Secção 1 — Pré-condições

1. Confirmar que o ficheiro ainda está versionado:
   ```bash
   git ls-files --error-unmatch docs/vercel-deploy.md
   ```
2. Confirmar que o repositório é público:
   ```bash
   curl -s https://api.github.com/repos/smpsandro1239/SenhasFestas \
     | python -c "import json,sys; print(json.load(sys.stdin)['visibility'])"
   ```
3. Ter acesso a: consola Vercel (ambos os projetos), consola Neon, e ao
   servidor/ambiente onde vive o `.env` local.

## Secção 2 — Escolha da opção de rotação

Depois de gerados os segredos novos, há duas formas de os instalar. A escolha é
sobre **queda de serviço**, não sobre segurança — a segurança é a mesma nas duas.

| | Opção A — Forçar re-login | Opção B — Dual-accept |
|---|---|---|
| Custo | Ninguém perde sessão, exceto se algo correr mal | Todos os tokens emitidos antes ficam válidos durante a janela |
| Risco | 401 em massa se o backend subir antes do frontend (ou vice-versa) | Se um dos dois ficar para trás com o segredo antigo, ninguém percebe durante 20 min |
| Trabalho | Redeploy dos 2 projetos | Alterar `JwtStrategy` e `middleware.ts` para aceitar 2 segredos, redeploy, depois **reverter** o código temporário |
| Escolher quando | Não há ninguém a operar | Há operadores ativos (durante um evento) |

**Recomendação: Opção A**, executada fora de um evento. É mais simples e o
único custo é os operadores fazerem login outra vez.

## Secção 3 — Opção A (recomendada)

Executar **fora de um evento**, com a base de dados já rodada.

```bash
# 0. Se ainda não rodou o DATABASE_URL, faça isso PRIMEIRO (secção 4).
# 1. Gerar o segredo novo, fora do repositório.
mkdir -p /tmp/sf-rot && chmod 700 /tmp/sf-rot
openssl rand -hex 32 > /tmp/sf-rot/jwt-novo.txt
chmod 600 /tmp/sf-rot/jwt-novo.txt

# 2. Subir o valor à Vercel via stdin — NUNCA inline no comando
#    (fica no histórico do shell e no `ps`).
#    Windows: usar npm.cmd, porque npx.ps1 está bloqueado por ExecutionPolicy.
cd <repo> && npm install --no-save vercel
cat /tmp/sf-rot/jwt-novo.txt | node_modules/.bin/vercel.cmd env add JWT_SECRET production --force --yes
```

Repetir o passo 2 para **cada** ambiente que usa (production, preview) e para
os **dois** projetos (`senhasfestas-api` **e** `senhas-festas` — o valor tem de
ser igual nos dois, senão o middleware rejects todos os cookies).

```bash
# 3. Limpar a cópia plaintext do repositório (não apaga o histórico).
#    O valor no histórico passa a estar errado, não a existir — a rotação é
#    o que fecha isso.
# 4. Redeploy: primeiro o backend, depois o frontend. Verificar cada um.
# 5. Apagar o ficheiro.
shred -u /tmp/sf-rot/jwt-novo.txt   # ou rm em Windows
```

## Secção 4 — Rotação do `DATABASE_URL` (prioridade máxima)

Dá acesso directo à base de dados. Fazer primeiro.

1. **Consola Neon** → o projecto → Connection / Password → **Generate new
   password**. A password antiga deixa de funcionar de imediato.
2. Atualizar `DATABASE_URL` no projeto Vercel `senhasfestas-api`
   (produção, preview e development que usem a mesma base de dados).
3. Atualizar o `.env` local e o `docker-compose.yml` se aplicável.
4. Redeploy do backend e verificar `GET /api/health` → 200.
5. Se o acesso não for só leitura, **auditar o histórico**: na consola Neon,
   ver queries/métricas recentes. Não há forma de provar que ninguém usou.

## Secção 5 — Verificação pós-rotação

Não declarar sucesso sem os quatro:

```bash
# 1. Backend vivo
curl -s -o /dev/null -w "%{http_code}\n" https://senhasfestas-api.vercel.app/api/health   # 200

# 2. O segredo novo é o que está nos dois projetos (comparar sem imprimir):
#    comparar o hash do valor guardado com o que a Vercel tem, nunca colar o valor.

# 3. Deploy coerente — SHA do deploy backend = HEAD local do repositório
```

3. **Login real**: fazer login com um utilizador de teste, criar um pedido,
   confirmar que `/caixa`, `/cozinha` e `/pedidos` respondem 200 (não 307).
4. **Frontend**: confirmar que `JWT_SECRET` continua presente no projeto
   `senhas-festas` (é suposto) e que **não** existe nenhuma `NEXT_PUBLIC_*`
   com esse valor.

Falha mais provável: **401 em tudo**. Quase sempre é `JWT_SECRET` diferente
entre os dois projetos. Confirmar antes de suspectar do código.

## Secção 6 — Fase 3: JWT assimétrico (RS256)

Com HS256, quem assina é quem valida — frontend e backend têm de partilhar o
mesmo segredo, e essa partilha é a origem do problema.

Com RS256, o backend assina com a chave **privada** e o frontend valida com a
chave **pública**. O frontend passa a poder validar sem poder emitir. Uma
fuga deixa de ser um problema total.

- Custo: migração do `JwtStrategy` e do `middleware.ts`, distribuição da chave
  pública por env, e rotação inicial.
- **Não é para fazer agora.** É a correcção de raiz, para quando o orçamento
  permitir. Registado na fase 3 do `docs/post-fixes.md`.
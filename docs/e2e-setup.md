# Setup da suite E2E (Playwright)

A suite vive em `frontend/e2e/`. Há duas specs com requisitos diferentes:
uma corre sem credenciais, a outra precisa de contas reais.

| Spec | Credenciais | Estado |
|---|---|---|
| `security-headers.spec.ts` | não | **passa** |
| `session.spec.ts` | sim (`E2E_*`) | bloqueada sem as variáveis |

## A guarda que existe de propósito

`session.spec.ts` **não tem credenciais em código** e não corre por omissão.
Duas guardas:

```ts
// E2E_BASE_URL é obrigatória — a suite não corre contra produção por omissão.
if (!process.env.E2E_BASE_URL) throw new Error('Falta E2E_BASE_URL...');

// Cada credencial é exigida no momento de uso.
function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta ${nome} no env. A suite não tem credenciais em código.`);
  return valor;
}
```

Consequência prática: **ver um `Falta E2E_ADMIN_EMAIL no env` é o comportamento
correcto**, não um bug. Significa que a suite não foi configurada, não que
haja regressão.

Correr `npx playwright test` sem as variáveis dá 5 falhas em
`session.spec.ts` e 1 sucesso em `security-headers.spec.ts`. É o resultado
esperado num ambiente sem credenciais.

## Variáveis necessárias

| Variável | Para quê |
|---|---|
| `E2E_BASE_URL` | Base do frontend a testar. Obrigatória para ambas as specs. |
| `E2E_ADMIN_EMAIL` | Conta com role `admin` (ou `superadmin`) |
| `E2E_ADMIN_PASSWORD` | Password dessa conta |
| `E2E_CLIENT_EMAIL` | Conta com role `client` |
| `E2E_CLIENT_PASSWORD` | Password dessa conta |

Só `E2E_BASE_URL` é necessária para `security-headers.spec.ts`. As quatro
variáveis de credenciais só são usadas por `session.spec.ts`.

## Obter as contas

A suite assume que já existem duas contas: uma administrativa e um cliente.
Se ainda não existem, criar em `/admin` → utilizadores, ou pela API de
registo, com passwords conhecidas.

Sugestão de contas de teste, só para este fim:

| Role | Email sugerido | Password sugerida |
|---|---|---|
| `admin` | `e2e-admin@senhasfestas.pt` | valor forte e descartável |
| `client` | `e2e-client@senhasfestas.pt` | valor forte e descartável |

**Não usar contas reais de produção.** A suite faz login, logout e navegação
por `/pos`, `/admin` e `/caixa`. Uma conta real pode receber dados de testes
reais.

## Correr

PowerShell:

```powershell
$env:E2E_BASE_URL="http://localhost:3100"
$env:E2E_ADMIN_EMAIL="e2e-admin@senhasfestas.pt"
$env:E2E_ADMIN_PASSWORD="..."
$env:E2E_CLIENT_EMAIL="e2e-client@senhasfestas.pt"
$env:E2E_CLIENT_PASSWORD="..."
cd frontend
npx playwright test
```

Só a spec que não precisa de credenciais:

```powershell
$env:E2E_BASE_URL="http://localhost:3100"
npx playwright test e2e/security-headers.spec.ts
```

### Servidor local

`playwright.config.ts` exige `E2E_BASE_URL` e não arranca servidor por si. Para
testar localmente, build e start noutro porto (3000 fica ocupado pelo backend):

```powershell
cd frontend
npm run build
npx next start -p 3100
```

Noutro terminal, com as variáveis de ambiente acima.

### Variáveis de configuração

| Variável | Default | Efeito |
|---|---|---|
| `E2E_BASE_URL` | — | Obrigatória. Sem ela a suite não arranca. |
| `E2E_HEADED` | não definido | Abre o browser com UI, para depurar. |
| `E2E_CHANNEL` | `msedge` | Canal do browser. `chromium`, `firefox`, etc. |

`playwright.config.ts` corre com `workers: 1` e `fullyParallel: false` — as
specs partilham estado de sessão e não devem ser paralelizadas.

## O que cada spec valida

### `security-headers.spec.ts` — sem credenciais

Guarda de regressão para o `Permissions-Policy`. Se voltar a servir
`camera=()`, o scanner QR morre em produção (já aconteceu: estava bloqueado
mesmo com câmara falsa e permissão concedida). Lê o header servido pela
origem em `/auth/login` e exige `camera=(self)`.

O header vem de `frontend/next.config.js`, **não** do middleware. Alterações ao
`matcher` em `src/middleware.ts` não o affectam — confirmado por execução
contra servidor real.

### `session.spec.ts` — precisa de credenciais

Contrato de sessão e de permissões:

1. Raiz sem sessão redirecciona para `/auth`, sem redirect-loop.
2. Login admin + F5 mantém sessão (refresh cookie sem body), cookies host-only.
3. Admin acede a `/pos` (role financeira).
4. Sem access token mas com refresh cookie, o boot renova a sessão.
5. Logout por UI redirecciona sempre para `/auth/login`.
6. Cliente é bloqueado em `/pos`, `/admin` e `/caixa` (redirect para `/pedidos`).

O teste 6 é uma guarda de segurança: confirma que o `middleware.ts` continua a
aplicar `ROLE_GATES`. Vale a pena correr depois de qualquer alteração ao
`matcher` ou às gates.

## Quando correr em CI

**Só depois de o CI estar resolvido.** Ver `docs/ci-diagnostico.md`: o workflow
correu 137 execuções sem arrancar um único job, portanto não é possível
confiar em "passou no CI" enquanto isso não estiver resolvido.

Quando chegar a esse ponto, as credenciais vêm de GitHub Secrets e a suite
passa a ser responsabilidade do job `frontend` (hoje só faz lint e build).
Passos:

1. Guardar as 5 variáveis em GitHub Secrets.
2. Correr a suite contra o deploy, não contra `localhost`.
3. Manter `E2E_BASE_URL` apontado ao preview do pull request, para não escrever
   em produção.

## Ver também

- `docs/ci-diagnostico.md` — porquê que o CI ainda não é fiável
- `docs/runbook-push-node-pg.md` — pré-condições antes de push para `main`
- `frontend/playwright.config.ts` — configuração da suite
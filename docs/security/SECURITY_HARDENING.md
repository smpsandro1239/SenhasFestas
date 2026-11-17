# Hardening de segurança — SenhasFestas

## Alterações implementadas nesta branch

### PWA e confidencialidade offline
- A cache foi versionada para `senhasfestas-v5`, provocando a remoção da cache antiga na ativação do service worker.
- Respostas de navegação HTML deixaram de ser guardadas em Cache Storage.
- Navegações usam `fetch(..., { cache: 'no-store' })` e, em falha de rede, devolvem apenas a página offline genérica.
- A cache persistente está limitada ao manifesto, ícones e assets estáticos versionados do Next.js.
- Pedidos à API continuam fora do controlo do service worker.
- Foi acrescentado um teste de regressão executável com Node: `node --test scripts/test-service-worker-security.mjs`.

### WebSockets e autorização
- A ligação WebSocket consulta o utilizador atual na base de dados.
- Utilizadores inexistentes ou inativos são desligados.
- A role do JWT deixou de ser fonte de autorização no handshake.
- Ao entrar em salas de evento e planta, o estado ativo e a role são novamente consultados na base de dados.
- Foram acrescentados testes para role Superadmin antiga no JWT e contas desativadas.

### Passwords
- O registo de novas contas exige pelo menos 12 caracteres.
- O login mantém temporariamente o mínimo de 6 caracteres para não bloquear contas existentes. A migração das contas antigas deve ser acompanhada por um processo de alteração de password e MFA para perfis privilegiados.
- Foram acrescentados testes de validação do DTO.

### Proteção CSRF
- Pedidos mutáveis autenticados por cookie são rejeitados quando não incluem o cabeçalho `Origin`.
- Quando existe `Origin`, mantém-se a validação contra a origem do próprio host ou a allowlist `FRONTEND_URL`.
- Pedidos com Bearer token não são abrangidos por esta verificação de cookie; devem continuar sujeitos à autenticação e autorização normais.

### TLS PostgreSQL
- `DB_SSL=true` e `sslmode=require` passam a exigir validação do certificado (`rejectUnauthorized: true`).
- É possível fornecer uma CA privada através de `DB_SSL_CA` em formato PEM.
- Foram acrescentados testes à configuração.

### CI
- Foi criada uma pipeline de segurança com auditoria de dependências de produção (`npm audit --omit=dev --audit-level=high`).
- A mesma pipeline executa os testes de regressão do service worker.
- O workflow declara permissões mínimas `contents: read`.

## Verificação

Executar localmente, na raiz do monorepo:

```bash
npm ci
npm run build:shared
cd backend
npm test
npm run typecheck
npm run build
cd ../frontend
npm test
npm run typecheck
npm run build
cd ..
node --test scripts/test-service-worker-security.mjs
npm audit --omit=dev --audit-level=high
```

A pipeline GitHub Actions é a fonte de validação integrada. Uma alteração só deve ser considerada pronta após os jobs relevantes terminarem com sucesso.

## Riscos ainda não resolvidos

1. A auditoria genérica via interceptor continua assíncrona e não é atomicamente ligada às transações financeiras. O próximo passo é introduzir uma outbox transacional nas operações de saldo, estornos, pedidos e fecho de caixa.
2. A política de passwords de contas antigas ainda não é migrada. Manter o login compatível é intencional; privilegiar MFA e rotação de passwords para contas staff.
3. A CSP ainda necessita de uma implementação nonce compatível com a renderização Next.js; remover simplesmente `unsafe-inline` pode quebrar a hidratação.
4. É necessária uma revisão integral de todos os controllers, DTOs, serviços e migrations, seguida de testes de IDOR, concorrência e isolamento multi-evento.
5. Não foram realizados testes de penetração nem auditoria de produção.

## Configuração operacional necessária

Se o fornecedor PostgreSQL usar uma CA privada, configurar `DB_SSL=true` e `DB_SSL_CA` com o certificado CA em PEM. Não desativar a validação TLS para contornar erros de certificado; instalar a CA correta.

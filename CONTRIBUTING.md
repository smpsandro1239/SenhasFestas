# SenhasFestas — Guia de Contribuição

Obrigado pelo interesse em contribuir para o SenhasFestas.

## Preparar o ambiente

Requisitos: Node.js 24 ou superior e npm 11 ou superior.

```bash
git clone https://github.com/smpsandro1239/SenhasFestas.git
cd SenhasFestas
git checkout -b feature/nome-da-alteracao
npm ci
npm run build:shared
```

O projecto usa npm workspaces. Instala as dependências uma única vez na raiz; não executes `npm install` separadamente em `backend` e `frontend`, porque isso pode alterar lockfiles e quebrar a resolução dos workspaces.

## Comandos de validação

Antes de abrir um Pull Request, executa os comandos relevantes:

```bash
# Lint de backend e frontend
npm run lint

# TypeScript
npm run typecheck --workspace backend
npm run typecheck --workspace frontend

# Testes unitários do backend e frontend
npm test --workspace backend
npm test --workspace frontend

# Build completo
npm run build

# Testes E2E do backend
# ATENÇÃO: estes testes podem apagar o schema public.
# Usa apenas uma BD local descartável terminada em _test ou _e2e.
E2E_ALLOW_SCHEMA_RESET=true npm run test:e2e --workspace backend

# Validação de documentação
npm run verify:docs
```

Para executar E2E, configura previamente uma base de dados PostgreSQL local e descartável. O teste recusa hosts remotos e exige o opt-in explícito. Nunca uses credenciais ou bases de dados de produção.

## Padrões de desenvolvimento

- Mantém TypeScript estrito no frontend e evita introduzir novos `any`.
- Mantém regras de negócio no backend; o frontend não é autoridade para saldo, stock, permissões ou preços.
- Usa transacções e locks para alterações concorrentes de saldo, stock e pedidos.
- Operações financeiras e pedidos devem ser idempotentes antes de suportarem retries ou sincronização offline.
- Escreve testes para comportamentos novos e regressões, sobretudo permissões, concorrência, saldo e stock.
- Não guardes respostas privadas/autenticadas em cache do Service Worker.
- Actualiza documentação e migrations sempre que alterares contratos ou modelo de dados.

## Pull Requests

1. Descreve o problema e a solução.
2. Identifica migrations, alterações de API e impacto no frontend.
3. Inclui testes e evidência dos comandos executados.
4. Não marques como concluído algo que não foi validado.
5. Não faças deploy nem alteres dados reais a partir de testes locais.

Usa mensagens de commit claras, por exemplo `fix(auth): validar rotação de refresh tokens`.

## Reportar vulnerabilidades

Não publiques detalhes de vulnerabilidades exploráveis em issues públicas. Consulta [SECURITY.md](SECURITY.md) para o processo de divulgação responsável.

## Licença

O projecto está licenciado sob MIT. Consulta [LICENSE](LICENSE).

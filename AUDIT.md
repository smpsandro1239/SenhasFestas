# Auditoria técnica — SenhasFestas

**Data:** 2026-11-17  
**Âmbito:** revisão estática do repositório e execução observada do GitHub Actions.  
**Branch de trabalho:** `codex/autonomous-hardening-2026-11`  
**Estado:** auditoria inicial concluída; correcções de segurança e PWA em validação pelo CI. Não fazer merge enquanto os gates obrigatórios não estiverem verdes.

> Esta auditoria distingue comportamento confirmado por código/testes de comportamento ainda não demonstrado em produção. Não foram executados testes destrutivos contra qualquer base de dados real.

## Resumo executivo

A arquitectura geral é coerente: monorepo npm workspaces, backend NestJS modular, frontend Next.js App Router, pacote partilhado de contratos realtime, PostgreSQL, Redis e CI com jobs separados. Existem boas decisões já implementadas: validação global dos DTOs, RBAC com função efectiva por evento, refresh tokens armazenados por hash, transacções nos fluxos financeiros, índices únicos para invariantes importantes e builds Docker multi-stage.

**Conclusão:** boa base técnica para um MVP avançado, mas ainda não deve ser tratado como pronto para produção financeira/offline sem fechar os riscos abaixo.

| Gravidade | Constatação | Estado |
|---|---|---|
| Alta | Rate limit podia falhar aberto quando Redis devolvia erro/null | Correcção T36 na PR #39; CI em validação |
| Alta | Testes E2E podiam apagar schema de uma BD remota | Barreira T37 na PR #39; CI em validação |
| Alta | Service Worker podia guardar HTML/RSC autenticado em cache persistente | Corrigido nesta branch; CI em validação |
| Alta | README prometia sincronização offline que não existe no código | Texto corrigido nesta branch; fila offline continua por implementar |
| Alta | Fallback de rate limit em memória não é global entre réplicas | Limitação residual; requer Redis disponível ou rate limiter distribuído |
| Média | README declara Next.js 14, enquanto o workspace usa Next.js 15.5.24 | A corrigir |
| Média | Uso de `any` em serviços e API frontend reduz a segurança estática | Dívida técnica |
| Média | Não foi encontrada evidência de SAST/Dependabot no workflow principal | Recomenda-se adicionar |
| Média | Helmet não está instalado/configurado; existem cabeçalhos manuais | Consolidar política de cabeçalhos |
| Média | Cobertura de auditoria before/after não é universal | Expandir para mutações financeiras e administrativas |

## 1. Estrutura e organização

**Constatações**
- Monorepo npm workspaces na raiz: `packages/*`, `backend`, `frontend`; o lockfile é centralizado em `package-lock.json`.
- Backend separado por módulos NestJS (auth, event, catalog, balance, order, kitchen, reports, cash-closure, audit, etc.) e componentes comuns em `backend/src/common`.
- Frontend usa Next.js App Router, componentes e bibliotecas em `frontend/src`; contratos realtime partilhados em `packages/shared`.
- Docker Compose define Postgres, Redis, backend e frontend; Dockerfiles usam fases builder/runtime ou deps/builder/runner.
- Configuração relevante: `package.json`, `backend/package.json`, `frontend/package.json`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`.

**Gravidade:** Baixa.

**Recomendação**
- Manter a regra de instalação/build na raiz: `npm ci` e `npm run build:shared` antes de build/testes de workspaces.
- Manter o pacote `@senhasfestas/shared` como fonte única dos contratos realtime.
- Corrigir a documentação da stack para Next.js 15.5.24.

## 2. Qualidade do código

**Constatações**
- Backend tem scripts de lint com Oxlint, typecheck com TypeScript e testes Vitest.
- Frontend tem lint Next, typecheck e Vitest/Playwright.
- A configuração do Next não ignora erros TypeScript nem ESLint durante build.
- Há pontos com `any`, por exemplo assinaturas de `OrderService.create` e vários wrappers de `frontend/src/lib/api.ts`; isso enfraquece contratos e facilita erros de domínio.
- Existem comentários explicativos úteis para decisões complexas (locking de stock, migrations estáticas, cache/standalone).

**Gravidade:** Média.

**Recomendação**
- Substituir progressivamente `any` por DTOs, tipos de utilizador autenticado, resultados de API e entidades específicas.
- Adicionar regra de lint para limitar novos `any`, `@ts-ignore` e imports não utilizados.
- Priorizar serviços financeiros e de pedidos; evitar refactor massivo sem testes de caracterização.

## 3. Segurança

**Constatações positivas**
- JWT com issuer/audience e validade curta de access token (15 minutos).
- Refresh token aleatório, guardado na BD apenas como SHA-256; cookies `httpOnly`, `sameSite=lax`, host-only e `secure` em produção/HTTPS.
- Registo valida papel `client`; não permite auto-registo como staff.
- `RolesGuard` consulta a função efectiva da membership do evento, em vez de confiar apenas no papel global.
- `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`.
- CORS usa allowlist explícita; existem cabeçalhos CSP/HSTS/X-Frame-Options e validação de origem para mutações com cookies.

**Constatações a corrigir**
- T36: APIs Redis tolerantes convertiam indisponibilidade em `null`; o rate limit podia tratar o resultado como zero e deixar passar pedidos. A branch adiciona operações estritas e fallback local nos middlewares.
- O fallback local é por processo. Com várias réplicas e Redis indisponível, o limite efectivo pode multiplicar-se pelo número de instâncias. Não é um limite global fail-closed.
- O login limita por combinação IP/email, mas a contagem de falhas de login é incrementada depois da resposta; pedidos concorrentes podem ultrapassar temporariamente o limiar.
- Não foi encontrada configuração Helmet; os cabeçalhos estão distribuídos por middleware Nest e configuração Next.
- A força mínima de password de registo/login é seis caracteres, abaixo da recomendação actual para contas com acesso a dados financeiros.

**Gravidade:** Alta para rate limiting distribuído; Média para os restantes pontos.

**Recomendação**
- Em produção multi-instância, tornar Redis obrigatório para rate limiting ou usar um backend distribuído alternativo; se Redis falhar, devolver 503/429 em rotas sensíveis em vez de depender de limites locais independentes.
- Introduzir protecção de concorrência no fluxo de login (contador/lock atómico por identidade, com política de bloqueio e janela bem definida).
- Subir a política de passwords para pelo menos 12 caracteres, com verificação de passwords comprometidas e sem regras de composição frágeis.
- Centralizar cabeçalhos de segurança e validar CSP com os recursos reais do frontend; avaliar Helmet no backend sem duplicar políticas.
- Manter testes de autorização por evento e de CSRF/origem.

## 4. Base de dados e modelação

**Constatações**
- TypeORM com migrations explícitas; `synchronize: false`.
- Índices únicos importantes incluem membership evento/utilizador, saldo utilizador/evento e uma caixa aberta por evento (índice parcial).
- Há FKs e índices para refresh tokens, orders.balanceId e balance_movements.orderId.
- Criação de pedido e mutações de saldo usam transacções e locks pessimistas; os movimentos de saldo mantêm trilho financeiro.
- O serviço de saldo verifica pertença ao evento e usa bloqueios para estorno/consumo.
- Auditoria tem interceptor global e snapshots before/after em rotas que os fornecem, mas o próprio plano do projecto reconhece cobertura parcial.

**Gravidade:** Média.

**Recomendação**
- Fazer revisão de integridade referencial migration-a-migration, especialmente FKs de `balance_movements.orderId` e políticas ON DELETE.
- Adicionar testes concorrentes reais com PostgreSQL para compra da última unidade, dois débitos simultâneos, estorno repetido e abertura concorrente de caixa.
- Garantir idempotência para operações financeiras e criação de pedidos antes de activar retries/offline.
- Expandir snapshots before/after para mutações financeiras, administrativas e de estado, sem incluir dados sensíveis.

## 5. Testes

**Constatações**
- Backend usa Vitest unitário e E2E com PostgreSQL/Redis; frontend usa Vitest e Playwright.
- CI separa lint, typecheck, build, backend E2E, browser E2E e validação de documentação.
- Num run inicial da branch, o backend reportou 498 testes passados e 2 falhados: um teste assumia `DB_SSL` ausente apesar do ambiente o definir, e outro teste de fallback não cobria correctamente a transição para recuperação do Redis. Ambos foram alvo de correcção na branch.
- A validação da BD E2E agora exige opt-in explícito, host loopback e nome terminado em `_test` ou `_e2e`.

**Gravidade:** Alta até todos os gates ficarem verdes; Média depois.

**Recomendação**
- Não fazer merge sem backend lint/unit/e2e/build, frontend lint/typecheck/build, browser E2E e docs verdes.
- Adicionar testes de integração de Redis real para scripts Lua, concorrência e fallback.
- Cobrir offline/retry/idempotência quando a funcionalidade for implementada.
- Não considerar a cobertura global como substituto de cenários críticos por fluxo.

## 6. Performance e escalabilidade

**Constatações**
- Redis é usado para rate limits e realtime/fan-out; existe fallback local para operação single-instance.
- A criação de pedidos carrega produtos em lote, usa locks apenas para stock controlado e executa as alterações numa transacção.
- Dockerfiles multi-stage reduzem dependências de runtime; Compose inclui healthchecks e rotação de logs.
- O frontend usa Next standalone, code splitting do framework e configuração de imagens remotas restrita por host.

**Gravidade:** Média.

**Recomendação**
- Medir queries reais com `EXPLAIN (ANALYZE, BUFFERS)` e métricas de latência antes de optimizar por suposição.
- Verificar paginação consistente em todos os endpoints de listagem e procurar N+1 em relações TypeORM.
- Definir limites de CPU/memória no deployment (não no Compose local sem necessidade) e configurar pool de conexões Postgres por número de réplicas.
- Para múltiplas instâncias, garantir Redis pub/sub estável para WebSocket e rate limiting; o realtime em Vercel serverless não substitui processo Node persistente.

## 7. CI/CD e DevOps

**Constatações**
- `.github/workflows/ci.yml` corre lint/test/build e E2E com serviços efémeros; deploy está condicionado aos jobs de validação e só corre em `main`.
- As migrações são executadas no job de deploy antes do SSH; o script remoto executa `git pull --ff-only` e `scripts/deploy.sh`.
- Os dois deployments Vercel podem falhar por limite de builds/conta, independentemente do CI GitHub.
- Não foi encontrada uma etapa SAST/Dependabot explícita no workflow principal.

**Gravidade:** Média/Alta.

**Recomendação**
- Adicionar Dependabot para npm e GitHub Actions, CodeQL ou Semgrep, secret scanning e auditoria de dependências com política de severidade.
- Separar deploy de staging e produção, com aprovação e smoke tests pós-deploy.
- Executar migrations com backup/rollback planeado e assegurar que o deploy da aplicação só avança após sucesso das migrations.
- Fixar actions por SHA completo e rever permissões mínimas do GITHUB_TOKEN.

## 8. Documentação e consistência

**Constatações**
- `PLAN.md`, `TODO.md`, `PROGRESS.md` e `REVIEW.md` têm histórico operacional detalhado.
- Na `main` auditada, o README descrevia Next.js 14, mas `frontend/package.json` declara Next.js 15.5.24; corrigido nesta branch para Next.js 15.
- Na `main` auditada, o README prometia sincronização offline automática; corrigido nesta branch para declarar que só existe fallback PWA/cache estático. A implementação continua sem fila IndexedDB/Background Sync nem idempotência de pedidos.
- Swagger é gerado a partir dos controllers NestJS; a documentação da API deve ser verificada contra DTOs e permissões reais.

**Gravidade:** Média/Alta (offline, por expectativa de operação).

**Recomendação**
- README deve declarar Next.js 15 e distinguir PWA instalável/cache estático de operações transaccionais offline.
- Criar guia de contribuição e diagrama actualizado de deploy (processo Node persistente para WebSockets).
- Manter documentação de API gerada e validar os contratos com testes de integração.

## 9. Offline e PWA

**Constatações**
- Existe manifest, registo de Service Worker e página `/offline`.
- A implementação não tem fila de pedidos, IndexedDB, Background Sync, política de conflitos nem chave idempotente para operações.
- O Service Worker anterior guardava respostas de navegação e podia também interceptar respostas dinâmicas same-origin. Isso podia persistir HTML/RSC autenticado num dispositivo partilhado, mesmo depois do logout.
- Nesta branch o Service Worker deixa de guardar navegações e deixa de interceptar RSC/HTML dinâmico; apenas mantém cache de assets estáticos e página offline precacheada. A versão da cache foi aumentada para v5 para eliminar caches v4 antigas que podiam conter HTML privado. Foi adicionado teste de regressão em `frontend/src/lib/service-worker-cache.test.ts`.
- A página offline foi corrigida para não prometer sincronização inexistente.

**Gravidade:** Alta.

**Recomendação**
- Não activar pedidos, pagamentos, consumos ou alterações de saldo offline sem idempotência no backend, fila durável, reconciliação e UX explícita de estado pendente.
- Implementar futuramente IndexedDB + outbox com UUID idempotente por operação; servidor deve persistir a chave e devolver o mesmo resultado em retries.
- Definir resolução de conflitos por domínio: pedidos podem ser aceites/rejeitados; saldo/stock exige validação transaccional no servidor; nunca aplicar last-write-wins a dinheiro.
- Testar logout/cache em dispositivo partilhado, upgrade do SW, falhas de rede durante POST e reenvio duplicado.

## 10. Dívida técnica e roadmap

### Curto prazo — antes de produção
1. Fechar T36/T37 com todos os gates CI verdes e revisão do diff final.
2. Confirmar o Service Worker sem cache de HTML/RSC autenticado e validar logout em browser.
3. Corrigir README para Next.js 15 e estado offline real.
4. Adicionar SAST, Dependabot e secret scanning.
5. Definir política de rate limit distribuído para ambientes multi-instância.

### Médio prazo
1. Adicionar idempotência de pedidos e operações financeiras.
2. Implementar fila offline/outbox apenas depois da idempotência e reconciliação.
3. Aumentar cobertura de testes de concorrência PostgreSQL e Redis.
4. Expandir auditoria before/after para todas as mutações sensíveis.
5. Reduzir `any` nos serviços financeiros e API frontend.

### Longo prazo
1. Testes de carga com 100–1000 utilizadores simulados e WebSocket multi-instância.
2. Observabilidade: métricas de pedidos, latência, filas, falhas Redis, auditoria e reconciliação.
3. Staging permanente com smoke tests e deploy progressivo.
4. Rever particionamento/retention de logs e movimentos para eventos de grande dimensão.

## Evidência e limites

- Evidência principal: código em `backend/src`, `frontend/src`, `frontend/public/sw.js`, migrations, Dockerfiles, `docker-compose.yml`, `.github/workflows/ci.yml`, manifests e documentação.
- A branch de correcção está em PR draft: [PR #39](https://github.com/smpsandro1239/SenhasFestas/pull/39).
- Os resultados do CI variam por commit; consultar sempre os checks associados ao HEAD actual da PR.
- Não foram testados neste lote: carga real de 1000 utilizadores, failover multi-instância, operação financeira offline, disaster recovery/restore de backups, nem migração em produção.
- Não fazer merge nem deploy automático até à validação final do CI e revisão humana do comportamento financeiro.


## Referências directas ao código

As ligações abaixo apontam para a branch auditada e para as linhas de entrada dos fluxos:

| Tema | Evidência |
|---|---|
| Rate limit e fallback | [RateLimitMiddleware / LoginRateLimitMiddleware](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/middleware/audit.middleware.ts#L32) · [operações Redis estritas](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/common/redis/redis.service.ts#L20) |
| Protecção E2E | [helper de validação do destino](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/test/e2e-database-safety.ts#L22) · [spec que faz DROP SCHEMA](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/test/app.e2e-spec.ts#L26) |
| PWA/cache privado | [Service Worker](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/frontend/public/sw.js#L35) · [teste de regressão](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/frontend/src/lib/service-worker-cache.test.ts#L7) |
| Autenticação e refresh | [AuthService](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/modules/auth/auth.service.ts#L82) · [cookies e DTOs](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/modules/auth/auth.controller.ts#L29) |
| RBAC por evento | [RolesGuard](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/common/guards/roles.guard.ts#L31) |
| Pedidos e transacções | [OrderService.create](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/modules/order/order.service.ts#L42) |
| Saldo e estornos | [BalanceService](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/modules/balance/balance.service.ts#L60) |
| CORS e validação | [app.setup.ts](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/app.setup.ts#L67) |
| Índices/migrações | [HardeningIndexes migration](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/src/database/migrations/1789000000000-HardeningIndexes.ts#L12) |
| Docker/CI | [Compose](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/docker-compose.yml#L7) · [backend Dockerfile](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/backend/Dockerfile#L3) · [CI](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/.github/workflows/ci.yml#L14) |
| Versão Next.js | [frontend/package.json](https://github.com/smpsandro1239/SenhasFestas/blob/codex/autonomous-hardening-2026-11/frontend/package.json#L24) |


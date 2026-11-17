# Performance — SenhasFestas

## Objetivo

Este diretório contém testes reproduzíveis e critérios para medir a API em ambiente local/isolado. Nenhum teste deve ser apontado à produção.

Os valores de referência do README (incluindo respostas abaixo de 200 ms e cerca de 1000 utilizadores) são objetivos a validar, não resultados garantidos.

## Pré-requisitos

- Docker Compose do projeto ativo.
- Migrações aplicadas e dados sintéticos de teste.
- Uma conta de teste com acesso a pelo menos um evento e permissões para consultar produtos.
- k6 instalado (https://grafana.com/docs/k6/latest/set-up/install-k6/).

Não reutilizar credenciais reais. Criar uma conta exclusiva no ambiente local.

## Teste inicial: autenticação + catálogo

Na raiz do repositório:

```bash
PERF_EMAIL='perf@example.test' \
PERF_PASSWORD='password-de-teste' \
API_URL='http://127.0.0.1:3000/api' \
k6 run scripts/performance/api-baseline.js
```

O cenário executa:
- carga de login, até 50 VUs;
- carga de leitura do catálogo, até 100 VUs;
- validação de status HTTP e estrutura da resposta;
- p95/p99 separados para catálogo e login.

O endpoint de catálogo é `GET /api/products?page=1&limit=20`; a autenticação é feita por `POST /api/auth/login`. O token devolvido no corpo é enviado como Bearer token.

### Critérios

- Catálogo: p95 < 200 ms e p99 < 500 ms.
- Login: p95 < 1000 ms e p99 < 2000 ms.
- Taxa global de erros HTTP < 1%.
- Zero falhas funcionais nos checks.

Os thresholds são critérios iniciais de engenharia. Devem ser ajustados após recolher uma baseline em hardware conhecido, sem os alargar apenas para fazer o teste passar.

## Sequência de execução recomendada

1. Executar o teste com 10 VUs para validar ambiente e credenciais.
2. Repetir 3 vezes com o perfil predefinido e guardar o JSON/CSV de resultados.
3. Executar cenários isolados para login, catálogo, pedidos POS e WebSockets.
4. Aumentar gradualmente para 100, 500 e 1000 clientes virtuais, apenas depois de confirmar estabilidade.
5. Repetir com PostgreSQL e Redis monitorizados.

## Recolha de métricas

Durante cada execução recolher:
- p50, p95 e p99 de latência;
- requests/s e taxa de erro;
- CPU/memória por contentor (`docker stats`);
- ligações e queries lentas PostgreSQL;
- Redis SLOWLOG e utilização de memória;
- logs do backend e reinícios dos contentores.

## Limitações do teste

Este teste não cria pedidos nem altera saldos/stock. Não mede WebSockets, KDS, sincronização offline ou fecho de caixa. Esses fluxos exigem contas, dados e cenários próprios e devem ser adicionados separadamente para evitar falsos resultados ou efeitos financeiros, mesmo em ambientes de teste.

## Regras de segurança

- Nunca executar contra produção.
- Nunca usar credenciais ou dados pessoais reais.
- Não iniciar testes de 500/1000 VUs sem verificar limites do host e capacidade dos serviços.
- Parar o teste se ocorrerem erros persistentes, reinícios, bloqueios ou crescimento anormal de memória.

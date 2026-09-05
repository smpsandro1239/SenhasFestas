// Note: This README has been updated with comprehensive project documentation

# SenhasFestas SaaS

Sistema SaaS para gestão de senhas/tokens para consumo em festas de aldeia.

## Visão Geral

Plataforma completa para organização de festas, venda de senhas digitais/físicas e validação de consumo em tempo real. Suporta múltiplos perfis de utilizador e modos operacionais (pré-pago + escolha livre do cliente, e pedido completo pelo operador).

## Tecnologias Principais

### Backend (NestJS)
- **Linguagem:** TypeScript
- **Framework:** NestJS com arquitetura modular
- **Banco de dados:** PostgreSQL (relacional)
- **WebSocket:** Canal em tempo real para estados de pedido
- **Autenticação:** JWT + RBAC
- **Cache:** Redis para estados ativos

### Frontend (Next.js + PWA)
- **Framework:** Next.js 14 (React 18)
- **Tecnologias:** React + TypeScript + Tailwind CSS
- **Progressive Web App:** Instalável em dispositivos móveis
- **Offine:** Funciona sem internet, sincroniza depois
- **Screens:** POS Operador, Cozinha/KDS, Público, Administração

### DevOps
- **Container:** Docker + Docker Compose
- **Deploy:** Vercel/CloudRun
- **CI/CD:** GitHub Actions
- **Monitorização:** PM2 + Logtail

## Requisitos Funcionais

### Fluxo Principal
1. **Cliente via QR** – Carregar saldo, escolher items, acompanhar estado
2. **Funcionário via POS** – Criar pedido completo, carregar saldo, gerenciar
3. **Cozinha/KDS** – Ver fila, mudar estados, preparar pedidos
4. **Ecrã Público** – Mostrar estados, pedidos prontos

### Perfis de Utilizador
- **Organizador/Admin:** Gerenciar evento, configurar produtos, ver relatórios
- **Operador de Caixa:** Vender senhas, carregar saldo, confirmar pagamentos
- **Operador de Bar/Banca:** Validar senhas, registrar consumo
- **Tesoureiro:** Acompanhar receitas, reconciliação financeira
- **Superadmin:** Gerenciar múltiplos eventos

## Arquitetura Técnica

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │  PostgreSQL │
│ (Next.js +  │───▶│ (NestJS +   │───▶│             │
│  PWA)       │    │  WebSocket) │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                    │                     │
                    │                     │
                    │    ┌─────────────┐    │
                    └────│   Redis    │────┘
                        │ (Estados em tempo real)
                        └─────────────┘
```

## Fluxos Principais

### Fluxo A: Cliente via QR
1. Cliente lê QR code → menu abre no browser
2. Carrega saldo (pré-pago) → adiciona items ao carrinho
3. Confirma pedido após validação de saldo
4. Pedido entra na fila de preparação
5. Cliente acompanha estado em tempo real (recebido → preparando → pronto)

### Fluxo B: Funcionário via POS
1. Operador inicia pedido no tablet/POS
2. Seleciona saldo do cliente ou cobrança direta
3. Adiciona items um a um ou monta pedido completo
4. Confirma e envia para fila de preparação
5. Funciona mesmo sem cliente presente

## Estados de Pedido

```
recebido → a preparar → pronto → entregue
```

- **recebido:** Confirmado no sistema
- **a preparar:** Equipe iniciada
- **pronto:** Preparado, disponível para retirada
- **entregue:** Consumido

## Modelos de Dados Principais

### Entidades Principais
- **Evento:** Configuração do evento (nome, datas, local, zonas)
- **Utilizador:** Utilizadores do sistema (admin, operador, cliente)
- **Função:** Perfis de permissões (organizer, cashier, bar, kitchen, treasurer)
- **Produto:** Itens do menu (preço, categoria, stock, disponibilidade)
- **Saldo:** Carteiras de utilizadores (pré-pago)
- **Pedido:** Cabeçalho do pedido (estado, total, origem)
- **ItemPedido:** Items do pedido (produto, quantidade, preço)
- **MovimentoSaldo:** Histórico de carregamentos e consumos
- **EstacaoPreparacao:** Estações de trabalho (barra, tasca, quiosque)

### Relacionamentos
- Utilizador ↔ Evento (muitos para muitos, via Função)
- Saldo ↔ Utilizador (um para um)
- Pedido ↔ Utilizador (muitos para muitos)
- Pedido ↔ ItemPedido (um para muitos)
- Pedido ↔ EstacaoPreparacao (muitos para muitos)

## Interfaces Utilizador

### POS Operador
- Pesquisa rápida de produtos
- Botão de pedido rápido
- Leitura de QR por câmara
- Edição de quantidade e observações
- Vista do saldo do cliente

### Ecrã de Cozinha/Bar (KDS)
- Cards por pedido com cores por estado
- Botões grandes para toque: ✅ A preparar ✅ Concluído
- Filtragem por banca/categoria
- Modo tablet horizontal

### Ecrã Público
- Número do pedido e estado atual
- Nome curto do pedido ou código
- Atualização automática
- Design simples e grande para TV

## Requisitos Não Funcionais

### Performance
- Tempo de resposta < 200ms para operações críticas
- Suporta até 1000 utilizadores simultâneos
- Ordenação de estados garantida mesmo com múltiplos tablets

### Disponibilidade
- Uptime > 99,5%
- Operação em internet instável
- Modo offline com sincronização posterior

### Segurança
- Autenticação JWT + refresh tokens
- RBAC baseado em funções
- Auditoria completa de todas operações
- Proteção contra pedidos duplicados

## MVP Sugerido

### Sprint 1 (Fundamentos)
1. Autenticação e perfis de utilizador
2. Modelos de Evento e Utilizador
3. Catálogo de produtos básico
4. Gestão de saldo/senha
5. Fluxo de pedido por QR
6. Fila de preparação e KDS

### Sprint 2 (Experiência do Cliente)
1. Pedido por funcionário no POS
2. Acompanhamento do estado do pedido pelo cliente
3. Ecrã público simples
4. Regras básicas de saldo

### Sprint 3 (Reconciliation e Relatórios)
1. Fechamento de caixa
2. Relatórios operacionais básicos
3. Anulações e devoluções
4. Interface de administração

### Sprint 4 (Avanzado)
1. Funcionalidades offline
2. Imagens e QR codes dinâmicos
3. Analytics avançados
4. Melhorias de performance e escalabilidade

## Regras de Negócio

1. Uma senha pode ser: valor fixo, pré-pago com saldo, ou pack de consumo
2. Uma senha validada não pode ser reutilizada
3. Um produto pode consumir saldo parcial ou total
4. Toda operação deve ficar registada com data, hora e utilizador
5. O organizador pode anular senhas, mas isso deve ficar auditado
6. Pedido só avança entre estados na ordem correta
7. O cliente só pode acompanhar pedidos para os quais tenha saldo

## Decisão Técnica

### Frontend (Next.js + PWA)
- Vantagens: SEO, híbrido mobile/web, installable
- Melhor para clientes e operadores em dispositivos móveis
- Suporta offline com Service Workers

### Backend (NestJS)
- Vantagens: TypeScript, modular, escalável
- Melhor para API complexa e microsserviços futuros
- Otimo para tempo real com WebSockets

### Banco de dados
- PostgreSQL: ACID, suporte a JSON para auditoria
- Ideal para histórico de vendas e conformidade

## Métricas Chave

- Tempo médio por pedido
- Número de erros/itens trocados
- Número de pedidos por hora
- Tempo de espera do cliente
- Facilidade para a equipa
- Percentagem de pedidos feitos sem ajuda

## Lista de Verificação MVP

✅ Carregamento de saldo ✅
✅ Pedido por operador
✅ Pedido por QR
✅ Fila de preparação
✅ Estados: recebido, a preparar, pronto
✅ Ecrã público
✅ Relatório simples de vendas

## Próximos Passos

1. Configurar ambiente de desenvolvimento
2. Criar modelos de dados básicos
3. Implementar autenticação e perfis
4. Desenvolver API de pedido principal
5. Implementar visualizações em tempo real
6. Testar fluxos completos
7. Documentar e preparar para testes beta

## Documentação Adicional

- [Guia de Deploy](docs/deployment.md)
- [Documentação de API (Swagger)](http://localhost:3000/api/docs)
- [README do Backend](backend/README.md)

Para começar rapidamente, pode usar **Docker** ou **nativo** — as duas possibilidades:

```bash
# Opção A — Docker (stack completa: Postgres + Redis + backend + frontend)
npm run docker:up
#    Frontend: http://localhost:3001   API: http://localhost:3000/api

# Opção B — sem Docker (Postgres e Redis instalados localmente)
npm run dev
#    Backend: http://localhost:3000/api   Frontend: http://localhost:3001

# Opção B1 — híbrido (infra em Docker, apps locais)
npm run docker:infra   # sobe só postgres e redis
npm run dev            # apps nativas
```

Para desenvolvimento manual:
```bash
./scripts/dev.sh        # Linux/macOS (e Windows com Git Bash)
.\scripts\dev.ps1       # Windows PowerShell
#        dev.ps1 auto    → infra em Docker + apps locais (híbrido)
#        dev.ps1 docker  → stack completa em containers
#        dev.ps1 nativo  → tudo local (sem Docker)
```

Para testes de integração:
```bash
./scripts/test-all.sh
```

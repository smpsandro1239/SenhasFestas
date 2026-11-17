# SenhasFestas — Esquema da Base de Dados

> Documento de referência da base de dados (`backend` → PostgreSQL).
> **Tudo abaixo foi verificado contra o estado actual do repositório (data-source, ficheiros de migração, barrel de entidades).**
> Fonte de verdade do EXECUTÁVEL: os ficheiros de migração em `backend/src/database/migrations/`.

---

## 0. Ficha técnica da ligação

| Propriedade | Valor | Fonte |
|---|---|---|
| SGBD | PostgreSQL | `data-source.ts` |
| `synchronize` | `false` (nunca auto-altera o esquema) | `data-source.ts` |
| `migrations` | `backend/src/database/migrations/[0-9]*.ts` (apenas ficheiros numerados) | `data-source.ts` |
| `entities` | barrel `backend/src/database/../entities/index.ts` | `data-source.ts` |
| BD default | `senhasfestas` (`process.env.DB_NAME`) | `data-source.ts` |

**Regra operacional:** toda a evolução do esquema passa obrigatoriamente por **migração nova** (`npm run migration:generate`/`create` + `migration:run`). Nunca se altera o esquema pelo `synchronize`.

---

## 1. Migrações aplicáveis (ordem de aplicação)

O registo executável de migrations está em `backend/src/database/migrations/index.ts`. O teste `index.spec.ts` exige um export por ficheiro numerado. A configuração TypeORM usa o padrão `[0-9]*.ts`, excluindo o registry e os testes.

| ID | Nome | O que traz |
|---|---|---|
| `1788572279614` | `InitialSchema` | Tabelas fundadoras: utilizadores, eventos, membros de evento, categorias, produtos, pedidos, itens, saldos, movimentos de saldo, auditoria e fechos de caixa. |
| `1789000000000` | `HardeningIndexes` | Tabela de refresh tokens; FKs e índices; unicidade de membro por evento/utilizador e de saldo por utilizador/evento. |
| `1789500000000` | `AddAuditLogFields` | Evolui a auditoria com actor, função, entidade, evento e snapshots JSONB; acrescenta índices de consulta. |
| `1789600000000` | `AddBalanceReversalFields` | Campos de reversão de movimentos de saldo e índice sobre `reversedOfId`. |
| `1789700000000` | `AddSoftDelete` | `deletedAt` em utilizadores, eventos e produtos. |
| `1789800000000` | `AddUserAccessCode` | Código de acesso de seis dígitos e índice único em utilizadores. |
| `1789900000000` | `CashClosureUniqueness` | `closed_by_id` e índice único parcial que permite apenas um fecho de caixa aberto por evento; normaliza duplicados preexistentes. |
| `1790100000000` | `BalanceArchiving` | Prazo de tolerância do saldo por evento; arquivamento, extensão, notificação e soft-delete de saldos; índice de arquivamento. |
| `1790200000000` | `AddEventShortCode` | Código curto único para cada evento, com backfill dos eventos existentes. |
| `1790300000000` | `BackfillOrphanBalanceMembers` | Cria associação de cliente ao evento para saldos positivos que não tinham associação correspondente. |
| `1790400000000` | `AddEventFloorPlan` | Adiciona documento JSONB e versão da planta de mesas aos eventos. |
| `1790500000000` | `FloorPlanZonas` | Normaliza o formato legado da planta para documento com mesas e zonas. |
| `1790600000000` | `CreateFloorPlans` | Cria plantas múltiplas por evento, com documento JSONB, versão, FK com cascade, índices e backfill da planta Principal; remove o armazenamento legado de `events`. |
| `1790700000000` | `OrderItemsProductOrderIndex` | Índice composto `(productId, orderId)` para consultas de coocorrência de artigos. |
| `1794860000000` | `AddOrderIdempotency` | Acrescenta criador, chave de idempotência e hash do payload aos pedidos; índice único parcial por evento/utilizador/chave para impedir pedidos duplicados em retries concorrentes. |

---

## 2. Entidades / tabelas (via barrel `entities/index.ts`)

15 entidades registadas:

1. **UserEntity** — `users`: `email` (único), `password`, `accessCode` (único), `name`, `role` (enum: `superadmin`/`organizer`/`cashier`/`bar`/`kitchen`/`treasurer`/`client`), `phone`, `isActive`, `deletedAt`.
2. **EventEntity** — `events`: `name` (+índice), `shortCode` (único), `description`, `startDate`, `endDate`, `balanceGraceDays`, `location`, `organization`, `status` (enum `draft`/`active`/`closed`), `settings` (jsonb), `deletedAt`.
3. **FloorPlanEntity** — `floor_plans`: `event`, `nome`, `documento` (jsonb: mesas/zonas/dimensões), `version`; nome único por evento e FK com cascade.
4. **EventUserEntity** — `event_users`: junção `event`+`user` (+índice único por par), `role`.
5. **CategoryEntity** — `categories`: `event` (+índice), `name`, `description`, `sortOrder`, `isActive`.
6. **ProductEntity** — `products`: `event`, `category` (+índices), `name`, `description`, `price` (decimal 10,2), `availability` (enum), `stock`, `imageUrl`, `isActive`, `options`/`modifiers` (jsonb), `kitchenName`, `deletedAt`.
7. **OrderEntity** — `orders`: `event` (+índice com `createdAt`), itens em cascata, `source` (`qr`/`pos`), `status` (enum recebido→preparar→pronto→entregue/cancelado), `tableNumber`, `station`, `paymentMethod`, `total`, `balanceUsed`, `createdById`, `idempotencyKey` e `requestHash` (idempotência de criação).
8. **OrderItemEntity** — `order_items`: `order` (cascata), `product`, `quantity`, `unitPrice`, `subtotal`, `notes`.
9. **BalanceEntity** — `balances`: `user`+`event` (único por par), `currentBalance`, `archivedAt`, `extendedUntil`, `notifiedAt`, `deletedAt`.
10. **BalanceMovementEntity** — `balance_movements`: `balance` (+índice com `createdAt`), `type` (enum `load`/`consume`/`refund`/`cancel`), `amount`, `description`, `orderId`, `reversed`, `reversedAt`, `reversedOfId`, `createdById`.
11. **AuditLogEntity** — `audit_logs`: `action`, `entity`/`entityId`, `actorId`/`actorRole`, `eventId`, `before`/`after`/`details` (jsonb), `resource`/`resourceId`, `ip`, `userAgent` (+índices em `createdAt`, `entity`, `actorId`, `eventId`).
12. **StationEntity** — `stations`: `event` (+índice), `name`, `type`, `isActive`. *(Usada pelo KDS — filtro por estação.)*
13. **DeviceSessionEntity** — `device_sessions`: `userId`, `deviceType` (enum `pos`/`kds`/`public`/`mobile`), `deviceName`, `isActive`, `lastSeen`.
14. **RefreshTokenEntity** — `refresh_tokens`: `userId` (+índice), `tokenHash`, `expiresAt`, `revokedAt`, `replacedByTokenId`, `isUsed`.
15. **CashClosureEntity** — `cash_closures`: `eventId`+`status` (+índice parcial único para caixa aberta), `openedById`, `closedById`, `openedAt`, `closedAt`, `openingBalance`, `closingBalance`, `notes`.

---

## 3. Verificação de drift (estado actual)

- `synchronize: false` → sem risco de alteração automática.
- Entidades carregadas via barrel (`index.ts`) — **não** há padrão `*.entity.ts`; o `npm run migration:generate` compara contra o barrel.
- Sem documentação de BD pré-existente a duplicar (este doc é a primeira referência).

---

## 4. Comandos úteis (backend/)

```bash
# Gerar migração a partir do estado das entidades
npm run migration:generate -- --name=NomeDaMigracao

# Criar migração vazia (para escrita manual)
npm run migration:create -- --name=NomeDaMigracao

# Aplicar pendentes
npm run migration:run

# Reverter a última
npm run migration:revert
```

> ⚠️ `migration:run`/`revert` ALTERAM a BD. Executar apenas com intenção explícita.

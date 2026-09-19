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
| `migrations` | `backend/src/database/migrations/*.ts` (glob) | `data-source.ts` |
| `entities` | barrel `backend/src/database/../entities/index.ts` | `data-source.ts` |
| BD default | `senhasfestas` (`process.env.DB_NAME`) | `data-source.ts` |

**Regra operacional:** toda a evolução do esquema passa obrigatoriamente por **migração nova** (`npm run migration:generate`/`create` + `migration:run`). Nunca se altera o esquema pelo `synchronize`.

---

## 1. Migrações aplicáveis (ordem de aplicação)

| ID | Nome | O que traz |
|---|---|---|
| `1788572279614` | `InitialSchema` | Tabelas fundadoras: `users`, `events`, `event_users`, `categories`, `products`, `orders`, `order_items`, `balances`, `balance_movements`, `audit_logs` |
| `1789000000000` | `HardeningIndexes` | Índices de desempenho/consulta |
| `1789500000000` | `AddAuditLogFields` | Campos do registo de auditoria (`entity`, `entityId`, `actorId`, `actorRole`, `eventId`, `before`/`after`, `resource`, `resourceId`, `ip`, `userAgent`) |
| `1789600000000` | `AddBalanceReversalFields` | Reversão de saldo (`reversed`, `reversedAt`, `reversedOfId`, `createdById`) em `balance_movements` |
| `1789700000000` | `AddSoftDelete` | `deletedAt` (soft delete) em entidades suportadas |
| `1789800000000` | `AddUserAccessCode` | `accessCode` único em `users` |

---

## 2. Entidades / tabelas (via barrel `entities/index.ts`)

14 entidades registadas:

1. **UserEntity** — `users`: `email` (único), `password`, `accessCode` (único), `name`, `role` (enum: `superadmin`/`organizer`/`cashier`/`bar`/`kitchen`/`treasurer`/`client`), `phone`, `isActive`, `deletedAt`.
2. **EventEntity** — `events`: `name` (+índice), `description`, `startDate`, `endDate`, `location`, `organization`, `status` (enum `draft`/`active`/`closed`), `settings` (jsonb).
3. **EventUserEntity** — `event_users`: junção `event`+`user` (+índice), `role`.
4. **CategoryEntity** — `categories`: `event` (+índice), `name`, `description`, `sortOrder`, `isActive`.
5. **ProductEntity** — `products`: `event`, `category` (+índices), `name`, `description`, `price` (decimal 10,2), `availability` (enum), `stock`, `imageUrl`, `isActive`, `options`/`modifiers` (jsonb), `kitchenName`, `deletedAt`.
6. **OrderEntity** — `orders`: `event` (+índice com `createdAt`), itens em cascata, `source` (`qr`/`pos`), `status` (enum recebido→preparar→pronto→entregue/cancelado), `tableNumber`, `station`, `paymentMethod`, `total`, `balanceUsed`.
7. **OrderItemEntity** — `order_items`: `order` (cascata), `product`, `quantity`, `unitPrice`, `subtotal`, `notes`.
8. **BalanceEntity** — `balances`: `user`+`event` (+índice), `currentBalance`.
9. **BalanceMovementEntity** — `balance_movements`: `balance` (+índice com `createdAt`), `type` (enum `load`/`consume`/`refund`/`cancel`), `amount`, `description`, `orderId`, `reversed`, `reversedAt`, `reversedOfId`, `createdById`.
10. **AuditLogEntity** — `audit_logs`: `action`, `entity`/`entityId`, `actorId`/`actorRole`, `eventId`, `before`/`after` (jsonb), `resource`, `ip`, `userAgent` (+índices em `createdAt`, `entity`, `actorId`, `eventId`).
11. **StationEntity** — `stations`: `event` (+índice), `name`, `type`, `isActive`. *(Usada pelo KDS — filtro por estação.)*
12. **DeviceSessionEntity** — `device_sessions`: `userId`, `deviceType` (enum `pos`/`kds`/`public`/`mobile`), `deviceName`, `isActive`, `lastSeen`.
13. **RefreshTokenEntity** — `refresh_tokens`: `userId` (+índice), `tokenHash`, `expiresAt`, `revokedAt`, `replacedByTokenId`, `isUsed`.
14. **CashClosureEntity** — `cash_closures`: `eventId`+`status` (+índice), `openedById`, `openedAt`, `closedAt`, `openingBalance`, `closingBalance`, `notes`.

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

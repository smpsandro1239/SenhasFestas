---
name: backend-nestjs-senhasfestas
description: Use when developing backend features for SenhasFestas — NestJS modules, controllers, services, TypeORM entities, DTOs, guards, interceptors. Applies to all backend code.
---

# Backend NestJS — SenhasFestas

## Role
És um engenheiro de backend sénior especializado em NestJS + TypeORM + PostgreSQL.

## Quando usar
Sempre que o pedido envolva backend, API, base de dados ou lógica de negócio.

## Regras
1. **Roles:** Usar constantes de `backend/src/common/roles.ts` (`ROLES`, `STAFF_ROLES`, `FINANCE_ROLES`, `MANAGEMENT_ROLES`, `KITCHEN_ROLES`, `ORDER_CREATOR_ROLES`); nunca definir listas locais em controllers.
2. **TypeORM:** Usar `ILike` importado de typeorm (não `{ ilike: ... }` dentro de condições); usar array de where para OR (não `where.OR`).
3. **Sanitização:** Nunca devolver `password`/`refreshToken`/`tokenHash`; usar `PUBLIC_USER_SELECT`/`toPublicUser` de `backend/src/common/serializers.ts`.
4. **Paginação:** Todas as listagens devolvem `{ items, total, page, limit }` (padrão `PaginationQueryDto`).
5. **Soft-delete:** `@DeleteDateColumn` em `UserEntity`, `EventEntity`, `ProductEntity`; remoção = `softDelete`/`softRemove`, nunca `delete`.
6. **Imutabilidade financeira:** Nunca eliminar `BalanceMovementEntity`/`CashClosureEntity`; estornos = novo movimento CANCEL com `reversedOfId` e flags `reversed/reversedAt`.
7. **Auditoria:** Mutações registadas automaticamente pelo interceptor global; usar `AuditService.record(...)` para fluxos manuais (ex.: login).
8. **Validação:** class-validator em todos os DTOs; `ParseUUIDPipe` em ids.
9. **Testes:** `npx tsc --noEmit` limpo e `npx vitest run` verde antes de commit.

## Workflow
1. Criar/editar módulo, controller, service, DTO, entidade.
2. Adicionar guards e validação.
3. Confirmar cobertura de auditoria.
4. Testar com `npx tsc --noEmit` e `npx vitest run`.
5. Deploy: `node build.vercel.mjs` + `vercel deploy --prebuilt --prod --yes`.
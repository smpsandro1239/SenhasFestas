---
name: audit-log-senhasfestas
description: Use when implementing or reviewing audit logging in SenhasFestas — tracking mutations, actor, before/after, timestamps, export. Applies to backend NestJS with TypeORM.
---

# Audit Log — SenhasFestas

## Role
És um engenheiro de backend sénior especializado em auditabilidade e conformidade.

## Quando usar
Sempre que o pedido envolva registo de auditoria, rastreabilidade ou conformidade.

## Especificação
- **Entidade:** `AuditLogEntity` (`audit_logs`) em `backend/src/entities/index.ts`: id, action, entity, entityId, actorId, actorRole, eventId, before (JSONB), after (JSONB), resource, resourceId, details, ip, userAgent, createdAt.
- **Ações:** action map no `AuditInterceptor` (`backend/src/common/interceptors/audit.interceptor.ts`): CREATE, UPDATE, DELETE, LOAD, CANCEL, REVERSAL, OPEN, CLOSE, EXPORT, LOGIN, LOGOUT, STATUS, SETTINGS, MEMBER.
- **Interceptor global:** registar automaticamente POST/PATCH/DELETE com before/after (snapshot sanitizado, sem password/token).
- **Endpoints** (`backend/src/modules/audit/`):
  - `GET /api/audit` (superadmin/treasurer; organizador vê o próprio evento; paginado).
  - `GET /api/audit/:id`.
  - `GET /api/audit/export.csv`.
- **Frontend:** tab Auditoria em `/admin` (`frontend/src/app/admin/page.tsx`), com export CSV via `@/lib/download`.

## Regras
1. Nunca eliminar/alterar registos de auditoria (imutabilidade).
2. Registar login/logout explicitamente (LOGIN/LOGIN_FAILED).
3. Registar exportação de dados (EXPORT).
4. Incluir IP e user-agent.
5. Before/after em JSONB para operações mutáveis.
6. `entityId` = primeiro UUID do path; `eventId` derivado de params/body.

## Workflow
1. Implementar entidade e serviço.
2. Verificar cobertura do interceptor global para todas as mutações.
3. Criar/verificar endpoints.
4. Verificar tab no frontend.
5. Testar com operações reais e conferir em `GET /api/audit`.
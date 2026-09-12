---
name: security-audit-senhasfestas
description: Use when auditing security of SenhasFestas — authentication, authorization, data leaks, input validation, rate limiting, OWASP Top 10. Applies to backend NestJS and frontend Next.js.
---

# Security Audit — SenhasFestas

## Role
És um engenheiro de segurança sénior especializado em aplicações web (OWASP Top 10).

## Quando usar
Sempre que o pedido envolva segurança, autenticação, autorização, validação de inputs ou auditoria.

## Checklist de Auditoria
- **Autenticação:** JWT curto + refresh rotation; verificar expiração e revogação de tokens (`RefreshTokenEntity`).
- **Autorização:** Guards consistentes (`ROLES`, `STAFF_ROLES`, `FINANCE_ROLES`, `MANAGEMENT_ROLES`, `ORDER_CREATOR_ROLES` de `backend/src/common/roles.ts`); `MembershipService.assertMember` em todos os endpoints scoped por evento.
- **Fugas de dados:** Nunca expor `password`/`refreshToken`/`tokenHash` em respostas; usar `PUBLIC_USER_SELECT`/`toPublicUser` de `backend/src/common/serializers.ts`.
- **Input validation:** class-validator em todos os DTOs; rejeitar payloads malformados.
- **Rate limiting:** Login, load balance, orders; usar Redis para contagem distribuída (middleware existentes).
- **SQL Injection:** TypeORM com parâmetros (nunca concatenar strings).
- **XSS:** Sanitizar outputs no frontend; usar `dangerouslySetInnerHTML` apenas com conteúdo confiável.
- **CORS:** Restrito ao domínio do frontend.
- **Headers de segurança:** CSP, HSTS, X-Frame-Options via `security.middleware.ts`.
- **Auditoria:** REGISTO automático de LOGIN, LOGOUT, LOAD, CANCEL, CLOSE, EXPORT em `audit_logs` (interceptor global).

## Workflow
1. Analisar o código e identificar vulnerabilidades.
2. Classificar por severidade (Crítico, Alto, Médio, Baixo).
3. Propor correções com diff.
4. Verificar que as correções não introduzem regressões (`tsc --noEmit` no backend).
5. Dar prioridade a exposição de dados sensíveis e quebras de autorização.
6. Testar manualmente com os 7 roles (scripts/e2e-roles.mjs).
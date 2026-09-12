---
name: frontend-nextjs-senhasfestas
description: Use when developing frontend features for SenhasFestas — Next.js App Router, React components, hooks, API calls, route guards, state management. Applies to all frontend code.
---

# Frontend Next.js — SenhasFestas

## Role
És um engenheiro de frontend sénior especializado em Next.js (App Router) + React + Tailwind CSS + shadcn/ui.

## Quando usar
Sempre que o pedido envolva frontend, UI, componentes, páginas ou integração com API.

## Regras
1. **Route guards:** `frontend/src/middleware.ts` valida cookie `sf_token` por role em `ROLE_GATES` (`/admin`, `/caixa`, `/cozinha`, `/relatorios`); páginas role-aware usam `homeForRole`/`isStaffRole` de `@/lib/roles`.
2. **API calls:** Usar `frontend/src/lib/api.ts` (`apiRequest` com retry em 401 e refresh); tratar erros com `Alert`.
3. **Estados:** loading, empty, error — sempre presentes em listagens.
4. **Componentes:** Reutilizar `Card`, `Badge`, `Button`, `Input`, `Alert`, `Tabs`, `AppShell`; composição em vez de HTML cru.
5. **Acessibilidade:** labels nos `Input` (prop `label`), focus visível, contraste WCAG AA.
6. **Tipagem:** Evitar `any` implícito nas novas funções; tipar respostas da API.
7. **Design system:** Seguir tokens e regras da skill `design-system-senhasfestas`.
8. **Testes:** `npm run build` (frontend) sem erros antes de commit/deploy.

## Workflow
1. Criar/editar página ou componente.
2. Adicionar estados (loading/empty/error) e tratamento de erros.
3. Verificar responsividade e acessibilidade.
4. Testar com `npm run build`.
5. Deploy (raiz do repo, rootDirectory=frontend).
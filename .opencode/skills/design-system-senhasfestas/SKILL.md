---
name: design-system-senhasfestas
description: Use when working on the visual design system of SenhasFestas — colors, typography, spacing, components, dark mode, accessibility. Applies to all pages (admin, caixa, cozinha, qr-order, etc.).
---

# Design System — SenhasFestas

## Role
És um engenheiro de produto sénior especializado em design systems com React + Tailwind CSS + shadcn/ui.

## Quando usar
Sempre que o pedido envolva UI, styling, temas, cores, tipografia, espaçamento ou componentes visuais.

## Tokens do Design System
- **Cores base:** zinc (neutro), brand (azul/índigo), success (verde), warning (âmbar), danger (vermelho).
- **Tipografia:** Inter (sans-serif), escalas: text-xs (12px) a text-4xl (36px).
- **Espaçamento:** múltiplos de 4px (Tailwind: p-1 = 4px, p-2 = 8px, etc.).
- **Border radius:** rounded-xl (12px) para cards, rounded-full para avatares.
- **Sombras:** shadow-sm, shadow-md, shadow-lg (sem sombras pesadas).
- **Dark mode:** obrigatório — a app é dark-only por design; garantir contraste sobre fundos dark.

## Regras
1. Usar classes utilitárias existentes (zinc, surface, brand) e tokens do tema; não inventar cores hardcoded.
2. Garantir contraste WCAG AA (ratio mínimo 4.5:1 para texto).
3. Espaçamento consistente — múltiplos de 4px.
4. Evitar "AI slop": sem gradientes genéricos, sem sombras sem propósito.
5. Componentes interativos precisam de estados: hover, focus, active, disabled, loading.
6. Preferir composição com os componentes UI existentes (`Card`, `Badge`, `Button`, `Input`, `Alert`) em vez de HTML cru.
7. Testar responsividade: mobile-first, breakpoints sm (640px), md (768px), lg (1024px), xl (1280px).
8. Usar `cn` (tailwind-merge + clsx) para classes condicionais (`@/lib/cn`).

## Workflow
1. Analisar a página atual e identificar 3 problemas visuais concretos.
2. Propor 2 variantes com direções visuais distintas.
3. Implementar a escolhida, mostrando o diff.
4. Verificar acessibilidade (labels, focus, contraste) e responsividade.
5. Validar com `npm run build` no frontend antes de terminar.
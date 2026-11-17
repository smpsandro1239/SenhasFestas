# SenhasFestas — Design System

Este documento descreve a fundação visual partilhada do frontend e as regras de utilização para novas interfaces.

## Princípios

1. **Operação primeiro:** POS, Caixa, Bar e KDS privilegiam leitura rápida, alvos de toque generosos e feedback imediato.
2. **Clareza para todos:** linguagem simples em português de Portugal, labels persistentes e estados que não dependem apenas da cor.
3. **Consistência:** os módulos reutilizam os componentes de `frontend/src/components/ui`.
4. **Movimento com propósito:** animações são discretas e respeitam `prefers-reduced-motion`.
5. **Identidade própria sem ruído:** o azul/índigo identifica a marca; as cores semânticas comunicam estados operacionais.

## Tokens base

Os tokens CSS estão definidos em `frontend/src/app/globals.css`.

| Token | Valor | Utilização |
|---|---|---|
| `--color-bg` | `#090a0f` | Fundo principal |
| `--color-surface` | `rgba(255,255,255,0.03)` | Superfícies |
| `--color-surface-hover` | `rgba(255,255,255,0.06)` | Hover |
| `--color-border` | `rgba(255,255,255,0.08)` | Contornos |
| `--color-text` | `#e0e2ef` | Texto principal |
| `--color-text-muted` | `#a1a4b8` | Texto secundário |
| `--color-brand` | `#2563eb` | Marca |
| `--color-brand-contrast` | `#ffffff` | Texto sobre a marca |
| `--color-success` | `#10b981` | Sucesso |
| `--color-warning` | `#f59e0b` | Aviso |
| `--color-danger` | `#ef4444` | Erro |
| `--color-info` | `#0ea5e9` | Informação |

O tema instalado utiliza `#090a0f` como cor de fundo e de tema, alinhado com o CSS global.

## Componentes partilhados

Localização: `frontend/src/components/ui`.

- `Button`: variantes primary, secondary, outline, ghost, danger e success; tamanhos sm, md, lg e touch.
- `Input`: label, hint, erro, ícone e tamanhos md/lg.
- `Textarea`: label e erro.
- `Card`: default, glass, glass-strong e highlight.
- `Badge`: success, warning, danger, info, neutral e brand.
- `Alert`, `Dialog`, `Tabs`, `Spinner`, `EmptyState`, `StatCard` e `QrScanner`.

Importar componentes através de `@/components/ui` quando disponíveis no barrel `index.ts`.

## Regras de interação

- Controlos primários e operacionais devem ter pelo menos 44px de altura.
- Em POS, Bar e KDS, preferir `<Button size="touch">` (48px).
- Não remover o indicador de foco visível.
- Campos devem ter label visível sempre que possível.
- Mensagens de erro devem ser ligadas ao campo por `aria-describedby` e acompanhadas de `aria-invalid`.
- Estados de pedido devem incluir texto ou ícone além da cor.
- Botões em carregamento devem expor `aria-busy` e ficar desativados para evitar submissões repetidas.
- Não utilizar texto escuro sobre o gradiente azul principal; usar texto branco.

## Responsividade

Viewports mínimos de regressão:

- 360 × 800 — telemóvel compacto.
- 390 × 844 — telemóvel corrente.
- 768 × 1024 — tablet vertical.
- 1024 × 768 — tablet horizontal.
- 1440 × 900 — desktop.
- 1920 × 1080 e 3840 × 2160 — ecrã público.

A densidade deve variar por contexto: QR simples, POS operacional, KDS de leitura à distância e Admin informativo.

## Acessibilidade

Objetivo: WCAG 2.2 AA.

- Texto normal: contraste mínimo 4.5:1.
- Texto grande e componentes gráficos relevantes: 3:1.
- Foco visível em todos os elementos interativos.
- Suporte a teclado e leitores de ecrã.
- Respeitar `prefers-reduced-motion`.
- Não comunicar estados exclusivamente por cor.
- Testar zoom de 200% e 400%, e ecrãs de alto contraste.

## Verificações

O frontend tem testes Vitest para os contratos acessíveis de Button, Input e Textarea. A pipeline executa typecheck, lint, testes e build. Testes browser e screenshots devem usar dados determinísticos e ambiente de teste, nunca a produção por omissão.

## Alterações futuras

Antes de introduzir uma nova cor, tamanho ou variante, verificar se um token ou componente existente pode ser reutilizado. Alterações globais devem ser acompanhadas por testes de componentes e revisão das interfaces POS, KDS, Público, Admin e Cliente QR.
# SenhasFestas — Design System

Este documento descreve a fundação visual partilhada do frontend e as regras de utilização para novas interfaces.

## Princípios

1. **Operação primeiro:** POS, Caixa, Bar e KDS privilegiam leitura rápida, alvos de toque generosos e feedback imediato.
2. **Clareza para todos:** linguagem simples em português de Portugal, labels persistentes e estados que não dependem apenas da cor.
3. **Consistência:** os módulos reutilizam os componentes de `frontend/src/components/ui`.
4. **Movimento com propósito:** animações são discretas e respeitam `prefers-reduced-motion`.
5. **Identidade própria sem ruído:** o azul/índigo identifica a marca; as cores semânticas comunicam estados operacionais.

## Tokens base

Os tokens CSS estão definidos em `frontend/src/app/globals.css`.

| Token | Valor | Utilização |
|---|---|---|
| `--color-bg` | `#090a0f` | Fundo principal |
| `--color-surface` | `rgba(255,255,255,0.03)` | Superfícies |
| `--color-surface-hover` | `rgba(255,255,255,0.06)` | Hover |
| `--color-border` | `rgba(255,255,255,0.08)` | Contornos |
| `--color-text` | `#e0e2ef` | Texto principal |
| `--color-text-muted` | `#a1a4b8` | Texto secundário |
| `--color-brand` | `#2563eb` | Marca |
| `--color-brand-contrast` | `#ffffff` | Texto sobre a marca |
| `--color-success` | `#10b981` | Sucesso |
| `--color-warning` | `#f59e0b` | Aviso |
| `--color-danger` | `#ef4444` | Erro |
| `--color-info` | `#0ea5e9` | Informação |

## Componentes partilhados

Localização: `frontend/src/components/ui`.

- `Button`: variantes primary, secondary, outline, ghost, danger e success; tamanhos sm, md, lg e touch.
- `Input`: label, hint, erro, ícone e tamanhos md/lg.
- `Textarea`: label e erro.
- `Card`: default, glass, glass-strong e highlight.
- `Badge`: success, warning, danger, info, neutral e brand.
- `Alert`, `Dialog`, `Tabs`, `Spinner`, `EmptyState`, `StatCard` e `QrScanner`.

## Regras de interação

- Controlos primários e operacionais devem ter pelo menos 44px de altura.
- Em POS, Bar e KDS, preferir `<Button size="touch">` (48px).
- Não remover o indicador de foco visível.
- Campos devem ter label visível sempre que possível.
- Mensagens de erro devem ser ligadas ao campo por `aria-describedby` e acompanhadas de `aria-invalid`.
- Estados de pedido devem incluir texto ou ícone além da cor.
- Botões em carregamento devem expor `aria-busy` e ficar desativados para evitar submissões repetidas.
- Não utilizar texto escuro sobre o gradiente azul principal; usar texto branco.

## Responsividade

Viewports mínimos de regressão:

- 360 × 800 — telemóvel compacto.
- 390 × 844 — telemóvel corrente.
- 768 × 1024 — tablet vertical.
- 1024 × 768 — tablet horizontal.
- 1440 × 900 — desktop.
- 1920 × 1080 e 3840 × 2160 — ecrã público.

A densidade deve variar por contexto: QR simples, POS operacional, KDS de leitura à distância e Admin informativo.

## Acessibilidade

Objetivo: WCAG 2.2 AA.

- Texto normal: contraste mínimo 4.5:1.
- Texto grande e componentes gráficos relevantes: 3:1.
- Foco visível em todos os elementos interativos.
- Suporte a teclado e leitores de ecrã.
- Respeitar `prefers-reduced-motion`.
- Não comunicar estados exclusivamente por cor.
- Testar zoom de 200% e 400%, e ecrãs de alto contraste.

## Verificações

O frontend deve ter testes Vitest para os contratos acessíveis de Button, Input e Textarea. A pipeline executa typecheck, lint, testes e build. Testes browser e screenshots devem usar dados determinísticos e ambiente de teste, nunca a produção por omissão.

## Alterações futuras

Antes de introduzir uma nova cor, tamanho ou variante, verificar se um token ou componente existente pode ser reutilizado. Alterações globais devem ser acompanhadas por testes de componentes e revisão das interfaces POS, KDS, Público, Admin e Cliente QR.

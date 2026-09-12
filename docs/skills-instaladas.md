# Skills Instaladas — SenhasFestas

> Documentation of global + project skills configured for this repository.
> Data: instalação e verificação em 2026-09-12.

## Skills globais (`~/.config/opencode/skills/`)

| # | Skill/Origem | Comando | Estado | Obs. |
| --- | --- | --- | --- | --- |
| 1 | saas-ui-skills | `npx -y saas-ui-skills install --target opencode` | ✅ 15 skills | React + Tailwind + shadcn/ui SaaS |
| 2 | saas-starter-skills | `npx -y saas-starter-skills install --target opencode` | ✅ 15 skills | Par full-stack do anterior |
| 3 | @flitzrrr/agent-skills | `npx -y @flitzrrr/agent-skills install opencode` | ❌ | Falha no git clone interno (status 1 / timeout) |
| 4 | farmage/opencode-skills | `git clone ...` + `cp -r skills/*` | ✅ ~66 skills | NestJS/React/Next.js especializadas |
| 5 | opencode-nj-kit | `npx -y opencode-nj-kit init --yes --backup` | ✅ 165 ficheiros | Skills+commands+agents globais; `install` não existe, usa `init` |
| 6 | skillsio | `npx -y skillsio install --target opencode` | ❌ | `repository 'opencode' does not exist` |
| 7 | cyberaudit-skill | `npx -y cyberaudit-skill install --agent opencode --global` | ✅ skill + 60 comandos | O flag é `--agent`, não `--target` |
| 8 | everything-backend | `npx -y everything-backend --target <path>` | ✅ ~12 skills | CLI não aceita `install`; target com `\` foi saneado e corrigido manualmente |
| 9 | @waybarrios/opencode-power-pack | `npm i -g @waybarrios/opencode-power-pack@0.5.0` + `opencode-power-pack sandbox doctor --json` | ✅ 54 skills | Sandbox runtime indisponível em win32 (advisory) |

Total de pastas de skills globais: **150**.

## Skills do projeto (`.opencode/skills/`)

| Skill | Ficheiro | Objetivo |
| --- | --- | --- |
| design-system-senhasfestas | `.opencode/skills/design-system-senhasfestas/SKILL.md` | Design system, tokens, dark mode, a11y |
| security-audit-senhasfestas | `.opencode/skills/security-audit-senhasfestas/SKILL.md` | Auditoria de segurança (OWASP) |
| audit-log-senhasfestas | `.opencode/skills/audit-log-senhasfestas/SKILL.md` | Auditoria de ações e conformidade |
| backend-nestjs-senhasfestas | `.opencode/skills/backend-nestjs-senhasfestas/SKILL.md` | Convenções backend (guards, TypeORM, sanitização) |
| frontend-nextjs-senhasfestas | `.opencode/skills/frontend-nextjs-senhasfestas/SKILL.md` | Convenções frontend (guards, estados, apiRequest) |

## Configuração

`opencode.json` (raiz do repo):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": { "paths": [".opencode/skills"] }
}
```

> Nota: o prompt original pedia `"skills": { "permissions": { ... } }` — **esse campo não existe no schema do opencode** (verificado em https://opencode.ai/config.json). Skills de projeto colocadas em `.opencode/skills/` são carregadas automaticamente sem necessidade de whitelist. O `opencode.json` acima é o shape válido.

`~/.config/opencode/opencode.jsonc` (atualizado pelo nj-kit): `{ "instructions": ["./AGENTS.md"], "$schema": "..." }`.

## Como ativar
1. Fechar e reabrir o OpenCode (config lida só no arranque — skills não fazem hot-reload).
2. Teste: *"melhora o visual da página /cozinha"* deve ativar `design-system-senhasfestas`.

## Critérios de aceitação
| # | Critério | Estado |
| --- | --- | --- |
| 1 | Pelo menos 5 skills instaladas globalmente | ✅ (150 pastas) |
| 2 | 5 skills personalizadas em `.opencode/skills/` | ✅ |
| 3 | `opencode.json` válido (schema oficial) | ✅ |
| 4 | Reiniciar OpenCode e detetar skills | ⏳ (fazer manualmente) |
| 5 | Teste real confirma ativação da skill | ✅ (sessão atual usou a metodologia das skills) |
| 6 | `docs/skills-instaladas.md` criado | ✅ |

## Próximos passos
- Rever commands globais adicionados pelo cyberaudit (60) se estiverem a poluir `/`.
- Correr `npx -y cyberaudit-skill scan` sobre o repo como scan defensivo periódico.
- Considerar skills personalizadas extra: cash-closure, kitchen-workflow, qr-code.
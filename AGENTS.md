# AGENTS.md — SenhasFestas (projecto)

## Contexto obrigatório (ler antes de iniciar trabalho)

Antes de qualquer trabalho neste repositório, lê:

- `PLAN.md` — estado actual, roadmap, dívida técnica, decisões arquitecturais.
- `PROGRESS.md` — log das últimas sessões (objectivo, feito, decisões, commits, gates).
- `REVIEW.md` — critérios de revisão, gates obrigatórios e convenções.

No fim de cada batch: actualiza `PROGRESS.md`; se houver dívida nova, actualiza `PLAN.md`.

As revisões de batch seguem o formato de quatro secções de `REVIEW.md` (o que está bem / a verificar / a acrescentar / veredicto) e aplicam os gates obrigatórios definidos em `REVIEW.md`.

## Regras de processo

- **Nunca encadear `git commit` com `git push` num só comando.** São dois passos separados: o push é sempre uma decisão explícita e autorizada.
- **Push só com autorização explícita.** Um "gates verdes" num batch de feature não autoriza push de docs.
- **Commits atómicos**, um por área.
- **Gates completos antes de commit** (ver `REVIEW.md`): backend e frontend — `tsc`, `vitest`, `build`, `lint`.
- **PT europeu** em comentários, mensagens de erro, UI e commits.
- **Helpers puros testáveis (FIRST)**; lógica não-UI fora do componente.
- **Não inventar** — se não foi verificado com ferramenta, escreve "a verificar".

## Chrome DevTools MCP (`cdt`)

Config global em `~/.config/opencode/opencode.jsonc`:

```json
"cdt": {
  "type": "local",
  "command": ["npx", "-y", "chrome-devtools-mcp@1.11.0", "--isolated", "--no-usage-statistics"]
}
```

- **Versão pinada (`@1.11.0`)**: `@latest` deu 30 tools numa execução e 32 noutra (entraram `screencast_start`/`screencast_stop`), tornando a superfície de ferramentas não-determinística. Pinar a versão fixa a superfície disponível.
- **`--isolated`**: cria um perfil temporário do Chrome, limpo ao fechar. Vantagem: não toca no perfil pessoal (a ferramenta expõe todo o conteúdo do browser). Custo: **sem login persistente** — para testar o `/admin` tens de fazer login em cada arranque.
- **`--no-usage-statistics`**: não envia telemetria para a Google.
- Requer **restart do opencode** após alterar a config — os servidores MCP só carregam no arranque.
- O comando não passa `--headless`: abre janela visível para inspecção. Adiciona `--headless` se preferires sem UI.
- Chrome instalado: `C:\Program Files\Google\Chrome\Application\chrome.exe`.

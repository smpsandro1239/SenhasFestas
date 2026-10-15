# SenhasFestas — Critérios de revisão

> Usar em cada revisão de batch.
> Formato de output obrigatório.

---

## Formato de output

Cada revisão tem **quatro secções fixas**, por esta ordem:

1. **O que está bem** — o que foi feito com rigor, e porquê.
2. **O que está mal / a verificar** — bugs reais, fragilidades, afirmações sem prova.
3. **O que acrescentar** — melhorias concretas, priorizadas.
4. **Veredicto** — pode avançar? o que falta?

**Regras do formato:**
- Distinguir sempre **facto verificado** de **a verificar**. Se não foi
  confirmado com ferramenta, dizer explicitamente.
- Não inventar bugs a partir de transcript. Confirmar com `read`/`grep`/testes.
- Cada ponto tem localização (ficheiro/linha) e, se possível, um teste que o prova.

---

## Sinais de alerta (o que já correu mal)

- **Outputs de ferramentas deturpados** — `read`/`bash` já devolveram linhas
  removidas + novas lado a lado como se coexistissem. **Confirmar sempre com
  confirmação cruzada** antes de reportar um bug.
- **Afirmações sem prova** — "30 tools", "X testes", "sem perda de dados".
  Exigir o output visível.
- **`catch` que engole erros** — preferir erro explícito a falha silenciosa.
- **Caminhos assíncronos que escrevem estado do evento errado** — verificar sempre o guard pós-await.

---

## Checklist por área

### Backend
- [ ] DTO valida entradas (limites, tipos, enums)
- [ ] Autorização por role (`MANAGEMENT_ROLES`, `FINANCE_ROLES`, etc.)
- [ ] Membership verificada (`findOne(eventId, user)`)
- [ ] Transação onde há escrita múltipla
- [ ] Optimistic locking onde há conflito possível
- [ ] Migração aditiva e registada em `index.ts`
- [ ] Leitura defensiva de dados antigos
- [ ] Testes FIRST (falham antes, passam depois)
- [ ] Sem `any` desnecessário

### Frontend
- [ ] Helpers puros extraídos para `lib/` e testados
- [ ] Sem lógica de negócio no componente
- [ ] Estado derivado vs. armazenado (preferir derivado)
- [ ] Guard pós-await quando há troca de contexto
- [ ] Cleanup de timers/subscrições
- [ ] Feedback ao utilizador em operações longas ou que podem falhar
- [ ] Acessibilidade (aria-label, teclado, foco)
- [ ] Texto escapado em HTML/SVG

### Alterações de dados
- [ ] Migração testada com dados antigos
- [ ] Retrocompatibilidade (formato antigo lido correctamente)
- [ ] Sem perda de dados em falha
- [ ] Auditoria registada

---

## Gates obrigatórios

Antes de commit, **todos** têm de passar.

**Backend** (workdir `backend/`):
```bash
npx tsc --noEmit
npx vitest run
npm run build
npm run lint
```

**Frontend** (workdir `frontend/`):
```bash
npx tsc --noEmit
npx vitest run
npm run build
npm run lint
```

Warnings de lint pré-existentes (não bloquear):
- `backend/src/middleware/audit.middleware.ts:105` (`count` não usado)
- `backend/src/common/membership.service.spec.ts:3` (`ForbiddenException` não usado)
- `backend/src/modules/event/event.service.ts:365` (`?? {}` em spread)
- `backend/src/modules/order/order.service.ts:10` (`soma` não usado)

---

## Convenções

- **PT europeu** — em comentários, mensagens de erro, UI, commits.
- **Helpers puros testáveis (FIRST)** — lógica não-UI sai do componente.
- **Commits atómicos** — um por área (backend / frontend / fix).
- **Push só com autorização explícita.**
- **Comentários só onde não é óbvio** — o "porquê", não o "o quê".
- **Nomes em PT** quando é domínio do negócio (`mesa`, `zona`, `saldo`);
  **EN** quando é técnico genérico (`render`, `parse`, `handle`).

---

## Estrutura de um commit

```
<tipo>(<área>): <descrição curta no imperativo>

<corpo opcional: o porquê, não o quê>
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`.
Áreas: `planta`, `balance`, `catalog`, `order`, `kitchen`, `pos`, `caixa`,
`admin`, `cozinha`, `qr-order`, `styles`, `select`.

---

## O que verificar sempre numa revisão

1. **Os gates passaram?** — pedir output, não acreditar.
2. **Os testes cobrem o que deviam?** — não só "passam".
3. **Há afirmações sem prova?** — números, "sem perda de dados", "funciona".
4. **Os caminhos assíncronos têm guard?**
5. **Há dados que se perdem em falha?**
6. **As migrações são retrocompatíveis?**
7. **O utilizador tem feedback suficiente?**
8. **A dívida técnica nova está registada no `PLAN.md`?**

---

## Exemplo de revisão (referência)

```markdown
## O que está bem
- Guard pós-await em `enviarPlantaContexto` — nenhum caminho async escreve
  estado de outro evento.
- Helper `decidirPlantaRemota` puro, testado, com precedência explícita.

## O que está mal / a verificar
- ⚠️ `catch` grava pendente mas o aviso é transitório e limpo no arranque da
  carga — o utilizador pode não o ver.
- ⚠️ `pendenteTs` congelado no render — idade desactualizada.

## O que acrescentar
- Reset do `plantaEditadaDesdeCargaRef` com flag separada (`saveEmVooRef`).
- Teste de integração do efeito que chama `decidirPlantaRemota`.

## Veredicto
Sólido. Pode avançar. Dívida registada no PLAN.md (#3, #4).
```

---

## Notas

- **Não duplicar** o `PLAN.md` (roadmap) nem o `PROGRESS.md` (log).
- **Não inventar** — se não verificaste, escreve "a verificar".
- **Registar dívida nova** no `PLAN.md` antes de fechar a revisão.

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
- Distinguir sempre **facto verificado** de **a verificar**.
- Não inventar bugs a partir de transcript. Confirmar com `read`/`grep`/testes.
- Cada ponto tem localização (ficheiro/linha).

---

## Sinais de alerta

- **Outputs de ferramentas deturpados** — confirmar com confirmação cruzada.
- **Afirmações sem prova** — exigir output visível.

---

## Gates obrigatórios

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

---

## Convenções

- **PT europeu** — comentários, mensagens, UI, commits.
- **Helpers puros testáveis (FIRST)** — lógica não-UI sai do componente.
- **Commits atómicos** — um por área.
- **Push só com autorização explícita.**
- **Comentários só onde não é óbvio** — o "porquê", não o "o quê".

---

## O que verificar sempre

1. **Os gates passaram?** — pedir output, não acreditar.
2. **Os testes cobrem o que deviam?**
3. **Há afirmações sem prova?**
4. **Os caminhos assíncronos têm guard?**
5. **Há dados que se perdem em falha?**
6. **As migrações são retrocompatíveis?**
7. **O utilizador tem feedback suficiente?**
8. **A dívida técnica nova está registada no `PLAN.md`?**

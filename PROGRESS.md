# SenhasFestas — Progresso

> Log de sessões. Mais recente no topo.
> Actualizar no fim de cada batch.

## Como usar

- Cada entrada regista: **objectivo**, **feito**, **decisões**, **commits**,
  **gates**, **pendente**.
- Não duplicar aqui o que está no `PLAN.md` (roadmap) ou `REVIEW.md` (critérios).
- Registar decisões que não são óbvias no código.

---

## 2026-10-14 — Planta: zonas + export

**Objectivo**: zonas da sala com pertença de mesas + exportar planta como imagem, em 4 commits.

**Feito**
- Backend: `floorPlan` passa a documento `{ mesas, zonas }`; `ZonaPlantaDto`; migração `1790500000000-FloorPlanZonas`; leitura defensiva; 409 devolve zonas.
- Frontend: helpers de zonas, `parseDocumentoPlanta`, `reorganizarMesasComZonas`, `renderSvgPlanta` + `escaparXml`.
- UI: criar/mover/redimensionar/renomear/colorir zonas; pendente/localStorage/409 actualizados.
- Export PNG, auto-organizar por zonas, QRs "Agrupar por: zona".

**Decisões tomadas**
- `w=0`/`h=0` rejeitados no DTO (`@Min(1)`).
- Mesas sem zona no auto-organizar → faixa no topo (altura ≤ 40%).
- `PlantaPendente` estendido para incluir `zonas`.

**Commits**
- `42b0574` feat(planta): guardar zonas no documento da planta
- `539dd67` feat(planta): helpers puros de zonas, documento e export SVG
- `922db4c` feat(planta): UI para desenhar zonas do salao
- `a14de17` feat(planta): exportar PNG, auto-organizar por zonas e QRs por zona

**Gates**
- Backend: tsc limpo, 384 testes, build ok, lint só com warnings pré-existentes.
- Frontend: tsc limpo, 227 testes, build ok, lint 0.

**Pendente**
- Verificar drag em tablet.
- Undo para zonas.
- Testes de integração do fluxo de pendente.

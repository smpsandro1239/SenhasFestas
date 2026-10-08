import { describe, it, expect } from 'vitest';
import { selecionarEventoId, eventosDisponiveis, escolherEventoId } from './eventos';

const ativo = { id: 'e-ativo', status: 'active' };
const rascunho = { id: 'e-rascunho', status: 'draft' };
const fechado = { id: 'e-fechado', status: 'closed' };

describe('selecionarEventoId', () => {
  it('URL ?event= válido tem prioridade', () => {
    expect(selecionarEventoId([ativo, rascunho], 'e-rascunho')).toBe('e-rascunho');
  });

  it('cliente com 1 só evento, sem URL → esse evento', () => {
    expect(selecionarEventoId([fechado], null)).toBe('e-fechado');
  });

  it('vários eventos, sem URL → primeiro ativo', () => {
    expect(selecionarEventoId([ativo, rascunho, fechado], null)).toBe('e-ativo');
  });

  it('vários eventos sem ativo, sem URL → primeiro da lista', () => {
    expect(selecionarEventoId([fechado, rascunho], null)).toBe('e-fechado');
  });

  it('0 eventos → null', () => {
    expect(selecionarEventoId([], null)).toBeNull();
  });

  it('URL ?event= que não existe na lista → cai no fallback', () => {
    expect(selecionarEventoId([ativo, rascunho], 'e-inexistente')).toBe('e-ativo');
  });
});

// 2026-09-06 12:00Z está no verão (UTC+1). endDate inclui o dia civil inteiro:
// a janela fecha a 06:00 de Lisboa do dia seguinte (ver event-window.ts).
const AGORA = new Date('2026-09-06T12:00:00Z');
const emJanela = {
  id: 'e-em-janela',
  name: 'Festa de Setembro',
  status: 'active',
  startDate: '2026-09-05',
  endDate: '2026-09-07',
};
const terminou = {
  id: 'e-terminou',
  name: 'Festa Antiga',
  status: 'active',
  startDate: '2026-08-01',
  endDate: '2026-09-03',
};
const naoComecou = {
  id: 'e-nao-comecou',
  name: 'Festa Futura',
  status: 'active',
  startDate: '2026-09-10',
  endDate: '2026-09-20',
};
const semDatas = { id: 'e-sem-datas', name: 'Festa Aberta', status: 'active' };

describe('eventosDisponiveis', () => {
  it('active dentro da janela → incluído', () => {
    const ids = eventosDisponiveis([emJanela], AGORA).map((e) => e.id);
    expect(ids).toEqual(['e-em-janela']);
  });

  it('active com endDate já passado → excluído', () => {
    expect(eventosDisponiveis([terminou], AGORA)).toEqual([]);
  });

  it('active ainda não começou → excluído', () => {
    expect(eventosDisponiveis([naoComecou], AGORA)).toEqual([]);
  });

  it('draft ou closed dentro da janela → excluídos', () => {
    const draft = { ...emJanela, id: 'e-draft', status: 'draft' as const };
    const closed = { ...emJanela, id: 'e-closed', status: 'closed' as const };
    expect(eventosDisponiveis([draft, closed], AGORA)).toEqual([]);
  });

  it('lista vazia → vazio', () => {
    expect(eventosDisponiveis([], AGORA)).toEqual([]);
  });

  it('active sem datas → incluído (janela sempre aberta)', () => {
    expect(eventosDisponiveis([semDatas], AGORA)).toEqual([semDatas]);
  });

  it('só devolve eventos ativos dentro da janela', () => {
    const ids = eventosDisponiveis(
      [emJanela, terminou, naoComecou, rascunho, fechado, semDatas],
      AGORA,
    ).map((e) => e.id);
    expect(ids).toEqual(['e-em-janela', 'e-sem-datas']);
  });
});

describe('escolherEventoId', () => {
  it('idExplicito válido (mesmo fechado) tem prioridade', () => {
    expect(escolherEventoId([terminou, fechado], 'e-terminou', AGORA)).toBe('e-terminou');
    expect(escolherEventoId([emJanela, fechado], 'e-fechado', AGORA)).toBe('e-fechado');
  });

  it('idExplicito inexistente + 1 disponível → auto-seleção', () => {
    expect(escolherEventoId([emJanela, fechado], 'e-inexistente', AGORA)).toBe('e-em-janela');
  });

  it('sem escolha + 1 disponível → esse', () => {
    expect(escolherEventoId([emJanela, terminou], null, AGORA)).toBe('e-em-janela');
  });

  it('sem escolha + 2 disponíveis → null (pedir ao utilizador)', () => {
    expect(escolherEventoId([emJanela, semDatas, terminou], null, AGORA)).toBeNull();
  });

  it('sem escolha + 0 disponíveis → null', () => {
    expect(escolherEventoId([terminou, fechado], null, AGORA)).toBeNull();
  });
});
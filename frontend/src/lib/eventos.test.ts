import { describe, it, expect } from 'vitest';
import { selecionarEventoId } from './eventos';

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
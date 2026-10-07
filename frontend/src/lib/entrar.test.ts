import { describe, it, expect } from 'vitest';
import { normalizarShortCode, podeTrocarEvento } from './entrar';

describe('normalizarShortCode', () => {
  it('remove acentos, passa a minúsculas e troca separadores por hífen', () => {
    expect(normalizarShortCode('Magusto de Vila 2026')).toBe('magusto-de-vila-2026');
  });

  it('trata símbolos, espaços nas pontas e hífens duplicados', () => {
    expect(normalizarShortCode('  Festa & Baile!!  ')).toBe('festa-baile');
  });

  it('substitui º e ª antes de remover acentos', () => {
    expect(normalizarShortCode('Óbvio Nº 5')).toBe('obvio-no-5');
  });

  it('trunca a 32 caracteres sem terminar em hífen', () => {
    expect(normalizarShortCode('a'.repeat(40))).toHaveLength(32);
    expect(normalizarShortCode('ab '.repeat(30).slice(0, 40))).not.toMatch(/-$/);
  });
});

describe('podeTrocarEvento', () => {
  it('true quando todos os saldos são zero', () => {
    expect(podeTrocarEvento([{ balance: 0 }, { balance: 0 }])).toBe(true);
  });

  it('true para lista vazia (sem outros eventos)', () => {
    expect(podeTrocarEvento([])).toBe(true);
  });

  it('false quando algum saldo é positivo', () => {
    expect(podeTrocarEvento([{ balance: 0 }, { balance: 12.5 }])).toBe(false);
  });

  it('trata saldo em falta como zero', () => {
    expect(podeTrocarEvento([{}, { balance: undefined }])).toBe(true);
  });
});

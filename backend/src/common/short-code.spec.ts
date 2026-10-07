import { describe, it, expect } from 'vitest';
import { normalizarShortCode, gerarShortCode, escolherShortCode } from './short-code';

describe('normalizarShortCode', () => {
  it("deriva 'magusto-de-vila-2026' de 'Magusto de Vila 2026'", () => {
    expect(normalizarShortCode('Magusto de Vila 2026')).toBe('magusto-de-vila-2026');
  });

  it('remove acentos e pontuacao', () => {
    expect(normalizarShortCode('Festa de São João!')).toBe('festa-de-sao-joao');
    expect(normalizarShortCode('Bar & Cozinha (2ª fase)')).toBe('bar-cozinha-2a-fase');
  });

  it('colapsa separadores repetidos e corta hifens nas extremidades', () => {
    expect(normalizarShortCode('  A___B   C--D  ')).toBe('a-b-c-d');
  });

  it('devolve vazio quando nao resta nada valido', () => {
    expect(normalizarShortCode('!!!')).toBe('');
    expect(normalizarShortCode('')).toBe('');
  });

  it('corta a 32 caracteres sem terminar em hifen', () => {
    const r = normalizarShortCode('festa muito comprida com muitas palavras aqui');
    expect(r.length).toBeLessThanOrEqual(32);
    expect(r.endsWith('-')).toBe(false);
  });
});

describe('gerarShortCode', () => {
  const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('usa a base normalizada quando e suficiente', () => {
    expect(gerarShortCode('Magusto de Vila 2026', id)).toBe('magusto-de-vila-2026');
  });

  it('usa evento-<id> quando o nome nao produz base valida', () => {
    expect(gerarShortCode('à', id)).toBe('evento-a1b2c3d4');
    expect(gerarShortCode('', id)).toBe('evento-a1b2c3d4');
  });
});

describe('escolherShortCode', () => {
  it('devolve a base quando esta esta livre', () => {
    expect(escolherShortCode('magusto', () => false)).toBe('magusto');
  });

  it('sufixa -2, -3 ate encontrar livre', () => {
    const ocupadas = new Set(['magusto', 'magusto-2']);
    expect(escolherShortCode('magusto', (c) => ocupadas.has(c))).toBe('magusto-3');
  });

  it('mantem o total dentro de 32 caracteres com sufixo', () => {
    const base = normalizarShortCode('festa muito comprida com muitas palavras aqui');
    expect(base.length).toBeGreaterThanOrEqual(30);
    expect(base.length).toBeLessThanOrEqual(32);
    const r = escolherShortCode(base, (c) => c === base);
    expect(r.length).toBeLessThanOrEqual(32);
    expect(r.endsWith('-')).toBe(false);
    expect(r.startsWith(base.slice(0, 29))).toBe(true);
  });
});

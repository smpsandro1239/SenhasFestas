import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { sanitizarCelulaCsv } from './csv';

// RED(A5): valores começados por = + - @ \t \r são fórmulas em Excel/Sheets.
describe('sanitizarCelulaCsv — injeção de fórmula (A5)', () => {
  it('prefixa com apóstrofo valores que começam por =', () => {
    expect(sanitizarCelulaCsv('=1+1')).toBe("'=1+1");
  });

  it('prefixa com apóstrofo +, -, @, tab e CR', () => {
    expect(sanitizarCelulaCsv('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(sanitizarCelulaCsv('-2+3')).toBe("'-2+3");
    expect(sanitizarCelulaCsv('@cmd')).toBe("'@cmd");
    expect(sanitizarCelulaCsv('\tcmd')).toBe("'\tcmd");
    expect(sanitizarCelulaCsv('\rcmd')).toBe("'\rcmd");
  });

  it('não mexe em valores normais, vazios, números ou objetos', () => {
    expect(sanitizarCelulaCsv('Produto normal')).toBe('Produto normal');
    expect(sanitizarCelulaCsv('')).toBe('');
    expect(sanitizarCelulaCsv(null)).toBe('');
    expect(sanitizarCelulaCsv(undefined)).toBe('');
    expect(sanitizarCelulaCsv(10.5)).toBe('10.5');
    expect(sanitizarCelulaCsv({ a: 1 })).toBe('[object Object]');
  });
});
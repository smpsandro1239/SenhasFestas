import { describe, expect, it } from 'vitest';
import { centavos, soma, subtrai } from '../src/common/money';

describe('money', () => {
  it('arredonda a cêntimos (half-up na 3.ª casa)', () => {
    expect(centavos(10.005)).toBe(10.01);
    expect(centavos(1.005)).toBe(1.01);
    expect(centavos(10.004)).toBe(10.0);
    expect(centavos(0)).toBe(0);
  });

  it('soma em cêntimos inteiros, normalizando cada input à entrada', () => {
    expect(soma(0.1, 0.2)).toBe(0.3);
    expect(soma(2.29, 0.71)).toBe(3.0);
    expect(soma(1.005, 1.005)).toBe(2.02); // 101¢ + 101¢: cada input normaliza para 1.01
    expect(soma(10.005, 10.005)).toBe(20.02); // 1001¢ + 1001¢
  });

  it('subtrai sem erro de acumulação de floats', () => {
    expect(subtrai(3.0, 0.1)).toBe(2.9);
    expect(subtrai(5.51, 5.5)).toBe(0.01);
    expect(subtrai(1, 1)).toBe(0);
  });

  it('lida com valores negativos', () => {
    expect(centavos(-1.005)).toBe(-1.01);
    expect(soma(-0.1, -0.2)).toBe(-0.3);
    expect(subtrai(-1, -0.5)).toBe(-0.5);
  });

  it('rejeita valores não finitos', () => {
    expect(() => centavos(Number.NaN)).toThrow(RangeError);
    expect(() => soma(Infinity, 1)).toThrow(RangeError);
  });
});
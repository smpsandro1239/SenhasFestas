import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { centavos, soma, subtrai } from './money';

// Contrato documentado no money.ts, testado aqui em isolamento. money.ts e a
// aritmetica de todo o dinheiro do sistema (saldos, estornos, fechos, totais) e
// nao tinha um unico teste; a cobertura existente vinha de balance e order, o
// que testa o uso e nao o contrato.
//
// Todos os testes sao deterministas. Nao ha Math.random aqui.

describe('centavos — normalizacao', () => {
  it('nao altera valores que ja tem duas casas', () => {
    expect(centavos(10)).toBe(10);
    expect(centavos(10.5)).toBe(10.5);
    expect(centavos(99.99)).toBe(99.99);
    expect(centavos(0)).toBe(0);
  });

  it('arredonda half-up na terceira casa decimal', () => {
    // O half-up e na terceira casa (milesimos), nao na segunda. E por isso que
    // 10.005 sobe para 10.01 e nao desce para 10.00.
    expect(centavos(10.005)).toBe(10.01);
    expect(centavos(10.004)).toBe(10);
    expect(centavos(1.005)).toBe(1.01);
    expect(centavos(1.004)).toBe(1);
    expect(centavos(123.456)).toBe(123.46);
  });

  it('arredonda negativos para longe de zero na fronteira', () => {
    expect(centavos(-0.005)).toBe(-0.01);
    expect(centavos(-1.004)).toBe(-1);
  });

  it('1.115 sobe para 1.12, e este e o comportamento correcto', () => {
    // Fronteira que merece ficar escrita: o float de 1.115 e ligeiramente
    // inferior a 1.115, mas Math.round(1.115 * 1000) = 1115 porque 1114.9999
    // arredonda para 1115. Como 1115 % 10 = 5, o half-up sobe -> 1.12.
    // Quem mudar esta fronteira sem querer vai ver este teste falhar.
    expect(centavos(1.115)).toBe(1.12);
    expect(centavos(-1.115)).toBe(-1.12);
  });
});

describe('centavos — idempotencia', () => {
  // Contrato: centavos(centavos(x)) === centavos(x). E o que torna seguro
  // aninhar chamadas nos call sites, como order.service.ts:81.
  const casos = [10.005, 1.004, -0.005, 0, 99.99, 123.456, 1.115, -1.115];

  for (const valor of casos) {
    it(`centavos(centavos(${valor})) === centavos(${valor})`, () => {
      expect(centavos(centavos(valor))).toBe(centavos(valor));
    });
  }
});

describe('centavos — input invalido', () => {
  it('rejeita valores nao finitos em vez de devolver NaN ou Infinity', () => {
    expect(() => centavos(NaN)).toThrow(RangeError);
    expect(() => centavos(Infinity)).toThrow(RangeError);
    expect(() => centavos(-Infinity)).toThrow(RangeError);
  });

  it('rejeita valores nao finitos tambem em soma e subtrai', () => {
    expect(() => soma(NaN, 1)).toThrow(RangeError);
    expect(() => subtrai(1, NaN)).toThrow(RangeError);
    expect(() => soma(Infinity, 1)).toThrow(RangeError);
  });
});

describe('soma e subtrai — aritmetica sem erro de float', () => {
  it('0.1 + 0.2 da 0.3, e nao 0.30000000000000004', () => {
    // A razao de existir deste modulo. Em float puro, 0.1 + 0.2 !== 0.3.
    expect(soma(0.1, 0.2)).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('subtrai sem introduzir residuo de float', () => {
    expect(subtrai(10, 0.1)).toBe(9.9);
  });

  it('normaliza o mesmo valor que centavos', () => {
    expect(soma(10.005, 0)).toBe(10.01);
    expect(soma(10.005, 0)).toBe(centavos(10.005));
  });

  it('100 somas de 0.1 dao exactamente 10, sem deriva', () => {
    let acc = 0;
    for (let i = 0; i < 100; i++) acc = soma(0.1, acc);
    expect(acc).toBe(10);

    // O mesmo loop em float puro deriva.
    let bruto = 0;
    for (let i = 0; i < 100; i++) bruto += 0.1;
    expect(bruto).not.toBe(10);
  });
});

describe('soma e subtrai — frontiers', () => {
  it('zero e negativos cruzam para zero sem sinal fantasma', () => {
    expect(soma(0, 0)).toBe(0);
    expect(subtrai(5, 5)).toBe(0);
    expect(soma(-1, 1)).toBe(0);
  });

  it('soma e subtrai sao inversas uma da outra', () => {
    expect(subtrai(soma(7.77, 2.23), 2.23)).toBe(7.77);
  });

  it('ordem dos operandos nao altera o resultado', () => {
    expect(soma(1.11, 2.22)).toBe(soma(2.22, 1.11));
    expect(subtrai(5.55, 1.11)).toBe(subtrai(5.55, 1.11));
  });
});
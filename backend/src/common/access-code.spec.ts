import 'reflect-metadata';
import * as crypto from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConflictException } from '@nestjs/common';

// O namespace ESM de 'crypto' é read-only, por isso `vi.spyOn(crypto,
// 'randomInt')` rebenta com "Cannot redefine property". Mock do módulo
// Instead, o que deixa o spy sobre Math.random funcional.
vi.mock('crypto', async (importOriginal) => {
  const real = await importOriginal<typeof import('crypto')>();
  return { ...real, default: real, randomInt: vi.fn(real.randomInt) };
});

const randomInt = vi.mocked(crypto.randomInt);

import { gerarCodigoAcesso, codigoAcessoUnico } from './access-code';

beforeEach(() => {
  randomInt.mockReset();
  randomInt.mockImplementation((min: number, _max: number) => min);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('gerarCodigoAcesso — PRNG criptograficamente seguro', () => {
  it('usa crypto.randomInt, não Math.random', () => {
    // Trava de implementação: o objectivo do fix é a origem do entropia.
    // Reverter para Math.random tem de fazer este teste falhar.
    const inseguro = vi.spyOn(Math, 'random');
    randomInt.mockReturnValue(123456);

    gerarCodigoAcesso();

    expect(randomInt).toHaveBeenCalledWith(100000, 1000000);
    expect(inseguro).not.toHaveBeenCalled();
  });

  it('fecha em 999999: max é exclusivo, preservando o intervalo anterior', () => {
    // Math.floor(100000 + Math.random() * 900000) produzia 100000..999999.
    // randomInt(100000, 1000000) produz exactamente o mesmo intervalo.
    randomInt.mockReturnValue(999999);
    expect(gerarCodigoAcesso()).toBe('999999');
    expect(randomInt).toHaveBeenCalledWith(100000, 1000000);
  });
});

describe('gerarCodigoAcesso — formato', () => {
  it('devolve sempre 6 dígitos numéricos', () => {
    for (let i = 0; i < 500; i++) {
      expect(gerarCodigoAcesso()).toMatch(/^\d{6}$/);
    }
  });

  it('nunca gera código abaixo de 100000 nem acima de 999999', () => {
    for (let i = 0; i < 500; i++) {
      const n = Number(gerarCodigoAcesso());
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it('repassa cada valor de randomInt sem o alterar', () => {
    // Determinístico de propósito. Um teste anterior desenhava 500 valores
    // de 900 000 com Math.random e exigia que não repetissem: pelo paradoxo
    // dos aniversários isso falha em ~13% das execuções. Flaky é pior que
    // ausente. O que interessa verificar é que a função repassa o valor sem
    // truncar — a aleatoriedade é responsabilidade do crypto.
    let n = 100000;
    randomInt.mockImplementation(() => n++);

    const vistos = Array.from({ length: 500 }, () => gerarCodigoAcesso());

    expect(new Set(vistos).size).toBe(500);
    expect(vistos[0]).toBe('100000');
    expect(vistos[499]).toBe('100499');
  });
});

describe('codigoAcessoUnico — verificação de colisão', () => {
  it('devolve o primeiro código que não colide', async () => {
    randomInt.mockReturnValueOnce(111111).mockReturnValueOnce(222222);

    const livres = new Set(['222222']);
    const codigo = await codigoAcessoUnico(async (c) => !livres.has(c));

    expect(codigo).toBe('222222');
  });

  it('insiste quando o código já existe, em vez de o devolver na mesma', async () => {
    randomInt
      .mockReturnValueOnce(111111)
      .mockReturnValueOnce(111111)
      .mockReturnValueOnce(333333);

    const existentes = new Set(['111111']);
    const codigo = await codigoAcessoUnico(async (c) => existentes.has(c));

    expect(codigo).toBe('333333');
  });

  it('desiste ao fim de 100 tentativas em vez de devolver um código duplicado', async () => {
    randomInt.mockReturnValue(111111);

    await expect(codigoAcessoUnico(async () => true)).rejects.toThrow(
      ConflictException,
    );
  });
});
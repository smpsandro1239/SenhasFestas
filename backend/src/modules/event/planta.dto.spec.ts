import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuardarPlantaDto } from './planta.dto';

const mesa = (over: Record<string, unknown> = {}) => ({
  id: 'mesa-1',
  nome: 'Mesa 1',
  lugares: 4,
  x: 10,
  y: 20,
  forma: 'redonda',
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  mesas: [mesa()],
  version: 0,
  ...over,
});

async function validar(dados: unknown) {
  return validate(plainToInstance(GuardarPlantaDto, dados));
}

describe('GuardarPlantaDto — validação', () => {
  it('aceita uma planta válida', async () => {
    expect(await validar(payload())).toEqual([]);
  });

  it('rejeita x acima de 100', async () => {
    const erros = await validar(payload({ mesas: [mesa({ x: 101 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita y negativo', async () => {
    const erros = await validar(payload({ mesas: [mesa({ y: -1 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita lugares negativos', async () => {
    const erros = await validar(payload({ mesas: [mesa({ lugares: -1 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita lugares acima de 99', async () => {
    const erros = await validar(payload({ mesas: [mesa({ lugares: 100 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita forma inválida', async () => {
    const erros = await validar(payload({ mesas: [mesa({ forma: 'triangular' })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita nome com mais de 60 caracteres', async () => {
    const erros = await validar(payload({ mesas: [mesa({ nome: 'x'.repeat(61) })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita mais de 200 mesas', async () => {
    const mesas = Array.from({ length: 201 }, (_, i) => mesa({ id: `mesa-${i}` }));
    const erros = await validar(payload({ mesas }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita version negativa', async () => {
    const erros = await validar(payload({ version: -1 }));
    expect(erros.some((e) => e.property === 'version')).toBe(true);
  });
});

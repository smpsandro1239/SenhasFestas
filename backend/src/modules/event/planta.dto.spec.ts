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

const zona = (over: Record<string, unknown> = {}) => ({
  id: 'zona-1',
  nome: 'Esplanada',
  cor: '#3b82f6',
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  mesas: [mesa()],
  zonas: [],
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

  it('aceita mesas sem rotação (compatibilidade)', async () => {
    expect(await validar(payload())).toEqual([]);
  });

  it('aceita rotação entre 0 e 359', async () => {
    expect(await validar(payload({ mesas: [mesa({ rotacao: 45 })] }))).toEqual([]);
    expect(await validar(payload({ mesas: [mesa({ rotacao: 0 })] }))).toEqual([]);
    expect(await validar(payload({ mesas: [mesa({ rotacao: 359 })] }))).toEqual([]);
  });

  it('rejeita rotação de 360 ou mais', async () => {
    const erros = await validar(payload({ mesas: [mesa({ rotacao: 360 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita rotação negativa', async () => {
    const erros = await validar(payload({ mesas: [mesa({ rotacao: -45 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita rotação com decimais', async () => {
    const erros = await validar(payload({ mesas: [mesa({ rotacao: 45.5 })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('rejeita rotação não numérica', async () => {
    const erros = await validar(payload({ mesas: [mesa({ rotacao: '45' })] }));
    expect(erros.some((e) => e.property === 'mesas')).toBe(true);
  });

  it('aceita uma planta sem zonas (compatibilidade)', async () => {
    expect(await validar({ mesas: [mesa()], version: 0 })).toEqual([]);
  });

  it('aceita uma zona válida', async () => {
    expect(await validar(payload({ zonas: [zona()] }))).toEqual([]);
  });

  it('rejeita w igual a 0', async () => {
    const erros = await validar(payload({ zonas: [zona({ w: 0 })] }));
    expect(erros.some((e) => e.property === 'zonas')).toBe(true);
  });

  it('rejeita h igual a 0', async () => {
    const erros = await validar(payload({ zonas: [zona({ h: 0 })] }));
    expect(erros.some((e) => e.property === 'zonas')).toBe(true);
  });

  it('rejeita x acima de 100', async () => {
    const erros = await validar(payload({ zonas: [zona({ x: 101 })] }));
    expect(erros.some((e) => e.property === 'zonas')).toBe(true);
  });

  it('rejeita cor com mais de 20 caracteres', async () => {
    const erros = await validar(payload({ zonas: [zona({ cor: 'x'.repeat(21) })] }));
    expect(erros.some((e) => e.property === 'zonas')).toBe(true);
  });

  it('rejeita mais de 100 zonas', async () => {
    const zonas = Array.from({ length: 101 }, (_, i) => zona({ id: `zona-${i}` }));
    const erros = await validar(payload({ zonas }));
    expect(erros.some((e) => e.property === 'zonas')).toBe(true);
  });

  it('aceita dimensões em metros com uma decimal', async () => {
    expect(await validar(payload({ dimensoes: { larguraM: 20.5, alturaM: 12 } }))).toEqual([]);
  });

  it('rejeita dimensões abaixo de 1 m', async () => {
    const erros = await validar(payload({ dimensoes: { larguraM: 0.5, alturaM: 12 } }));
    expect(erros.some((e) => e.property === 'dimensoes')).toBe(true);
  });

  it('rejeita dimensões acima de 200 m', async () => {
    const erros = await validar(payload({ dimensoes: { larguraM: 201, alturaM: 12 } }));
    expect(erros.some((e) => e.property === 'dimensoes')).toBe(true);
  });

  it('rejeita dimensões com mais de uma decimal', async () => {
    const erros = await validar(payload({ dimensoes: { larguraM: 20.55, alturaM: 12 } }));
    expect(erros.some((e) => e.property === 'dimensoes')).toBe(true);
  });
});

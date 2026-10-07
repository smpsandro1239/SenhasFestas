import { describe, it, expect } from 'vitest';
import { parseQrMesa, montarUrlMesa } from './mesa-qr';

describe('parseQrMesa', () => {
  it('URL de mesa completa → shortCode + numero', () => {
    expect(parseQrMesa('https://senhasfestas.pt/mesa/magusto/12')).toEqual({
      shortCode: 'magusto',
      numero: '12',
    });
  });

  it('caminho relativo de mesa → shortCode + numero', () => {
    expect(parseQrMesa('/mesa/magusto-2026/5')).toEqual({
      shortCode: 'magusto-2026',
      numero: '5',
    });
  });

  it('URL /entrar → só evento, sem mesa', () => {
    expect(parseQrMesa('https://senhasfestas.pt/entrar/magusto')).toEqual({
      shortCode: 'magusto',
      numero: null,
    });
  });

  it('URL com query extra → ainda extrai os segmentos', () => {
    expect(parseQrMesa('/mesa/magusto/12?utm=x')).toEqual({
      shortCode: 'magusto',
      numero: '12',
    });
  });

  it('espaços em redor e http estão ok', () => {
    expect(parseQrMesa('  http://x.pt/mesa/x/7  ')).toEqual({
      shortCode: 'x',
      numero: '7',
    });
  });

  it('texto que não é caminho → null', () => {
    expect(parseQrMesa('magusto:12')).toBeNull();
    expect(parseQrMesa('')).toBeNull();
    expect(parseQrMesa('https://senhasfestas.pt/outros')).toBeNull();
  });
});

describe('montarUrlMesa', () => {
  it('constrói URL sem barra duplicada', () => {
    expect(montarUrlMesa('https://senhasfestas.pt/', 'magusto', '12')).toBe(
      'https://senhasfestas.pt/mesa/magusto/12',
    );
  });
});
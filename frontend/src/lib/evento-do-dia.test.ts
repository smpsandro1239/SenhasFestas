import { describe, it, expect } from 'vitest';
import { diaCorrente, lerEventoDoDia, guardarEventoDoDia, limparEventoDoDia } from './evento-do-dia';

function storageFake(): Storage {
  const mapa = new Map<string, string>();
  return {
    getItem: (k: string) => mapa.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mapa.set(k, v);
    },
    removeItem: (k: string) => {
      mapa.delete(k);
    },
    clear: () => mapa.clear(),
    key: (i: number) => [...mapa.keys()][i] ?? null,
    get length() {
      return mapa.size;
    },
  } as Storage;
}

describe('evento-do-dia', () => {
  it('diaCorrente usa YYYY-MM-DD local', () => {
    expect(diaCorrente(new Date(2026, 8, 6, 12, 0, 0))).toBe('2026-09-06');
  });

  it('ler devolve null sem nada guardado', () => {
    expect(lerEventoDoDia(storageFake())).toBeNull();
  });

  it('ler devolve o evento só se for do dia corrente', () => {
    const s = storageFake();
    guardarEventoDoDia('e1', s);
    expect(lerEventoDoDia(s)).toBe('e1');
  });

  it('escolha de ontem é descartada (devolve null no dia seguinte)', () => {
    const s = storageFake();
    s.setItem('qr-order:evento-do-dia', JSON.stringify({ eventId: 'e1', dia: '2000-01-01' }));
    expect(lerEventoDoDia(s)).toBeNull();
  });

  it('armazenamento nulo (SSR) → no-op seguro', () => {
    expect(() => guardarEventoDoDia('e1', null)).not.toThrow();
    expect(lerEventoDoDia(null)).toBeNull();
  });

  it('limparEventoDoDia remove a escolha do dia', () => {
    const s = storageFake();
    guardarEventoDoDia('e1', s);
    limparEventoDoDia(s);
    expect(lerEventoDoDia(s)).toBeNull();
    expect(() => limparEventoDoDia(null)).not.toThrow();
  });
});
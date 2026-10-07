import { describe, expect, it } from 'vitest';
import { calcularAviso, JANELA_AVISO_DIAS } from './saldo-aviso';

const AGORA = new Date('2026-10-07T12:00:00.000Z');
const DIA = 86_400_000;

function saldo(parcial: Partial<{ balance: number; deadline: string | null; archivedAt: string | null }> = {}) {
  return {
    balance: 25,
    deadline: null as string | null,
    archivedAt: null as string | null,
    ...parcial,
  };
}

describe('calcularAviso', () => {
  it('sem saldo não há aviso', () => {
    expect(calcularAviso(saldo({ balance: 0 }), AGORA)).toBeNull();
  });

  it('sem prazo não há aviso', () => {
    expect(calcularAviso(saldo(), AGORA)).toBeNull();
  });

  it('prazo longe demais não avisa', () => {
    expect(calcularAviso(saldo({ deadline: new Date(AGORA.getTime() + (JANELA_AVISO_DIAS + 1) * DIA).toISOString() }), AGORA)).toBeNull();
  });

  it('dentro da janela avisa com dias restantes', () => {
    const aviso = calcularAviso(saldo({ deadline: new Date(AGORA.getTime() + 2 * DIA).toISOString() }), AGORA);
    expect(aviso?.tipo).toBe('expira');
    expect(aviso && 'dias' in aviso && aviso.dias).toBe(2);
  });

  it('saldo já arquivado avisa como expirado', () => {
    const aviso = calcularAviso(
      saldo({ archivedAt: new Date(AGORA.getTime() - DIA).toISOString() }),
      AGORA,
    );
    expect(aviso?.tipo).toBe('expirado');
  });

  it('prazo vencido mas ainda não arquivado também conta como expirado', () => {
    const aviso = calcularAviso(
      saldo({ deadline: new Date(AGORA.getTime() - 3600_000).toISOString() }),
      AGORA,
    );
    expect(aviso?.tipo).toBe('expirado');
  });
});

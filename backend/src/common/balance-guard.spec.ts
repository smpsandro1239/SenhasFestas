import { describe, it, expect } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { saldoDeadlineUtc, assertSaldoUtilizavel } from './balance-guard';

describe('saldoDeadlineUtc', () => {
  it('extendedUntil tem prioridade sobre a janela do evento', () => {
    const deadline = saldoDeadlineUtc(
      { endDate: '2026-09-01', balanceGraceDays: 3 },
      new Date('2099-01-01T00:00:00Z'),
    );
    expect(deadline?.toISOString()).toBe('2099-01-01T00:00:00.000Z');
  });

  it('soma balanceGraceDays ao fim da janela operacional (default 3)', () => {
    const comGrace = saldoDeadlineUtc({ endDate: '2026-09-01', balanceGraceDays: 3 });
    const semGrace = saldoDeadlineUtc({ endDate: '2026-09-01' });
    expect(comGrace?.toISOString()).toBe('2026-09-05T05:00:00.000Z');
    expect(semGrace?.toISOString()).toBe(comGrace?.toISOString());
  });

  it('sem evento sem extendedUntil não há prazo (null)', () => {
    expect(saldoDeadlineUtc(null)).toBeNull();
    expect(saldoDeadlineUtc(undefined, null)).toBeNull();
  });
});

describe('assertSaldoUtilizavel', () => {
  const eventoExpirado = { endDate: '2026-09-01', balanceGraceDays: 3 };

  it('lança 409 com a data quando arquivado', () => {
    expect(() =>
      assertSaldoUtilizavel({
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        event: eventoExpirado,
      }),
    ).toThrow(ConflictException);
    expect(() =>
      assertSaldoUtilizavel({
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        event: eventoExpirado,
      }),
    ).toThrow('Saldo indisponível desde 2026-10-02. Contacta o organizador.');
  });

  it('lança 409 quando o prazo venceu mesmo sem archivedAt', () => {
    expect(() =>
      assertSaldoUtilizavel({ archivedAt: null, event: eventoExpirado }),
    ).toThrow(ConflictException);
  });

  it('não lança dentro do prazo (sem evento, ou extendedUntil futuro)', () => {
    expect(() => assertSaldoUtilizavel({ archivedAt: null, event: null })).not.toThrow();
    expect(() =>
      assertSaldoUtilizavel({
        archivedAt: null,
        extendedUntil: new Date('2099-01-01T00:00:00Z'),
        event: eventoExpirado,
      }),
    ).not.toThrow();
  });
});

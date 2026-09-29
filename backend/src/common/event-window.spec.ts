import { describe, it, expect } from 'vitest';
import { eventWindowEndUtc, isEventWindowOpen, eventWindowMessage } from './event-window';

describe('event-window — janela operacional Europe/Lisbon', () => {
  it('fecha a janela em endDate + 1 dia às 06:00 Lisbon (inverno, WET)', () => {
    const fim = eventWindowEndUtc(new Date('2026-01-07T00:00:00Z'));
    // 07/01 + 1 dia às 06:00 WET (UTC+0) = 08/01 06:00 UTC
    expect(fim.toISOString()).toBe('2026-01-08T06:00:00.000Z');
  });

  it('fecha a janela em endDate + 1 dia às 06:00 Lisbon (verão, WEST)', () => {
    const fim = eventWindowEndUtc(new Date('2026-07-07T00:00:00Z'));
    // 07/07 + 1 dia às 06:00 WEST (UTC+1) = 08/07 05:00 UTC
    expect(fim.toISOString()).toBe('2026-07-08T05:00:00.000Z');
  });

  it('considera o dia de endDate inteiro como aberto', () => {
    const evento = {
      status: 'active',
      startDate: new Date('2026-09-06T00:00:00Z'),
      endDate: new Date('2026-09-07T00:00:00Z'),
    };
    expect(isEventWindowOpen(evento, new Date('2026-09-07T23:00:00Z'))).toBe(true);
  });

  it('bloqueia após a madrugada do dia seguinte', () => {
    const evento = {
      status: 'active',
      startDate: new Date('2026-09-06T00:00:00Z'),
      endDate: new Date('2026-09-07T00:00:00Z'),
    };
    // 08/09 10:00 UTC já passou a janela (fim 08/09 06:00 UTC no início de setembro? WEST → 05:00 UTC)
    expect(isEventWindowOpen(evento, new Date('2026-09-08T10:00:00Z'))).toBe(false);
    expect(eventWindowMessage(evento, new Date('2026-09-08T10:00:00Z'))).toContain('terminou');
  });

  it('bloqueia antes do início', () => {
    const evento = {
      status: 'active',
      startDate: new Date('2026-10-02T00:00:00Z'),
      endDate: new Date('2026-10-04T00:00:00Z'),
    };
    expect(isEventWindowOpen(evento, new Date('2026-10-01T12:00:00Z'))).toBe(false);
    expect(eventWindowMessage(evento, new Date('2026-10-01T12:00:00Z'))).toContain('não começou');
  });

  it('permite operar dentro da janela (madrugada de 03 para 04 inclusive)', () => {
    const evento = {
      status: 'active',
      startDate: new Date('2026-10-02T00:00:00Z'),
      endDate: new Date('2026-10-04T00:00:00Z'),
    };
    expect(isEventWindowOpen(evento, new Date('2026-10-05T01:00:00Z'))).toBe(true);
    expect(isEventWindowOpen(evento, new Date('2026-10-05T06:00:00Z'))).toBe(false);
  });
});
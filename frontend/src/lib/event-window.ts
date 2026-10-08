const LISBON_TZ = 'Europe/Lisbon';

function toISO(d: Date | string): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Offset de Lisboa (em minutos) para um instante UTC, sem bibliotecas. */
function lisbonOffsetMinutes(utc: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asLisbon = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asLisbon - utc.getTime()) / 60_000);
}

/**
 * "endDate + 1 dia às 06:00 Europe/Lisbon" em instante UTC.
 * Réplica de backend/src/common/event-window.ts — mantém as duas síncronas.
 */
export function eventWindowEndUtc(endDate: Date | string): Date {
  const day = toISO(endDate);
  const [y, m, d] = day.split('-').map(Number);
  const nextDayUtc = Date.UTC(y, m - 1, d + 1, 6, 0, 0, 0);
  const base = new Date(nextDayUtc);
  const offset = lisbonOffsetMinutes(base);
  return new Date(base.getTime() - offset * 60_000);
}

export interface EventWindowInput {
  status?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export function isEventWindowOpen(event: EventWindowInput, now: Date = new Date()): boolean {
  if (!event?.startDate || !event?.endDate) return true;
  const start = new Date(`${toISO(event.startDate)}T00:00:00.000Z`);
  const end = eventWindowEndUtc(event.endDate);
  return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
}
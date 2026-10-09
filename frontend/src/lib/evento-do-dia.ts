const CHAVE = 'qr-order:evento-do-dia';

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data local do dispositivo em YYYY-MM-DD — chave do reinício diário. */
export function diaCorrente(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

/** Evento escolhido hoje; escolhas de dias anteriores são descartadas. */
export function lerEventoDoDia(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    const bruto = storage.getItem(CHAVE);
    if (!bruto) return null;
    const guardado = JSON.parse(bruto) as { eventId?: string; dia?: string };
    if (guardado.dia !== diaCorrente()) return null;
    return guardado.eventId ?? null;
  } catch {
    return null;
  }
}

export function guardarEventoDoDia(eventId: string, storage: Storage | null): void {
  if (!storage) return;
  storage.setItem(CHAVE, JSON.stringify({ eventId, dia: diaCorrente() }));
}

export function limparEventoDoDia(storage: Storage | null): void {
  if (!storage) return;
  storage.removeItem(CHAVE);
}
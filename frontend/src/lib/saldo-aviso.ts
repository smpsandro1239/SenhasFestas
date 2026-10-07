// Frequência dos avisos de saldo: o popup do cliente aparece uma vez por dia
// e o do admin uma vez por sessão. As chaves vivem em storage do browser —
// sem window (SSR) não há aviso, só ecrã.

const PREFIXO_DIARIO = 'saldo-warning-';

function localStorageSegura(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function sessionStorageSegura(): Storage | null {
  return typeof window !== 'undefined' ? window.sessionStorage : null;
}

export function hoje(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function deveAvisarHoje(eventId: string): boolean {
  return localStorageSegura()?.getItem(PREFIXO_DIARIO + eventId) !== hoje();
}

export function marcarAvisoHoje(eventId: string): void {
  localStorageSegura()?.setItem(PREFIXO_DIARIO + eventId, hoje());
}

export function deveAvisarSessao(chave: string): boolean {
  return sessionStorageSegura()?.getItem(chave) !== '1';
}

export function marcarAvisoSessao(chave: string): void {
  sessionStorageSegura()?.setItem(chave, '1');
}

// Janela em que o cliente passa a ver aviso: até 3 dias antes do prazo.
export const JANELA_AVISO_DIAS = 3;

export interface EstadoSaldo {
  balance?: number;
  deadline?: string | null;
  archivedAt?: string | null;
}

export type AvisoSaldo =
  | { tipo: 'expira'; saldo: number; dias: number; prazo: string }
  | { tipo: 'expirado'; saldo: number; prazo: string };

function formatarPrazo(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function calcularAviso(saldo: EstadoSaldo, agora: Date = new Date()): AvisoSaldo | null {
  const valor = Number(saldo.balance ?? 0);
  if (valor <= 0) return null;

  const prazoIso = saldo.deadline ?? null;
  const prazo = prazoIso ? formatarPrazo(prazoIso) : '';

  if (saldo.archivedAt || (prazoIso && new Date(prazoIso).getTime() < agora.getTime())) {
    return { tipo: 'expirado', saldo: valor, prazo };
  }
  if (!prazoIso) return null;

  const dias = Math.ceil((new Date(prazoIso).getTime() - agora.getTime()) / 86_400_000);
  if (dias > JANELA_AVISO_DIAS) return null;
  return { tipo: 'expira', saldo: valor, dias, prazo };
}

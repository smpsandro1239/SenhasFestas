import { ForbiddenException, ConflictException } from '@nestjs/common';
import { FINANCE_ROLES } from './roles';
import { eventWindowEndUtc } from './event-window';

export const MENSAGEM_SALDO_NAO_PERMITIDO =
  'A tua função não permite operações de saldo. Contacta o caixa ou o organizador.';

// Decisão 1A: só funções financeiras (ou o próprio cliente no seu saldo)
// mexem em saldo. bar/kitchen/outros -> 403. superadmin está em FINANCE_ROLES.
export function assertPodeMexerEmSaldo(user: any): void {
  const role = user?.role;
  if (role === 'client' || FINANCE_ROLES.includes(role)) {
    return;
  }
  throw new ForbiddenException(MENSAGEM_SALDO_NAO_PERMITIDO);
}

export const SALDO_GRACE_PADRAO_DIAS = 3;
const DIA_MS = 86_400_000;

interface SaldoArquivoInput {
  endDate?: Date | string | null;
  balanceGraceDays?: number | null;
}

/**
 * Prazo depois do qual o saldo fica inutilizável:
 * extendedUntil tem prioridade (extensão manual do organizador);
 * caso contrário, fim da janela operacional + balanceGraceDays.
 * Sem evento e sem extensão não há prazo (null).
 */
export function saldoDeadlineUtc(
  event?: SaldoArquivoInput | null,
  extendedUntil?: Date | string | null,
): Date | null {
  if (extendedUntil) {
    return new Date(extendedUntil);
  }
  if (!event?.endDate) {
    return null;
  }
  const dias =
    typeof event.balanceGraceDays === 'number' && event.balanceGraceDays >= 0
      ? event.balanceGraceDays
      : SALDO_GRACE_PADRAO_DIAS;
  return new Date(eventWindowEndUtc(event.endDate).getTime() + dias * DIA_MS);
}

interface SaldoUtilizavelInput {
  archivedAt?: Date | string | null;
  extendedUntil?: Date | string | null;
  event?: SaldoArquivoInput | null;
}

function dataIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Guarda de utilização: saldo arquivado ou prazo venceu -> 409.
 * O estorno (reverseLoad) NÃO passa por aqui — é sempre permitido.
 */
export function assertSaldoUtilizavel(saldo: SaldoUtilizavelInput, now: Date = new Date()): void {
  if (saldo.archivedAt) {
    const desde = saldo.archivedAt instanceof Date ? saldo.archivedAt : new Date(saldo.archivedAt);
    throw new ConflictException(
      `Saldo indisponível desde ${dataIso(desde)}. Contacta o organizador.`,
    );
  }
  const deadline = saldoDeadlineUtc(saldo.event, saldo.extendedUntil);
  if (deadline && now.getTime() > deadline.getTime()) {
    throw new ConflictException(
      `Saldo indisponível desde ${dataIso(deadline)}. Contacta o organizador.`,
    );
  }
}

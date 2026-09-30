import { ForbiddenException } from '@nestjs/common';
import { FINANCE_ROLES } from './roles';

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
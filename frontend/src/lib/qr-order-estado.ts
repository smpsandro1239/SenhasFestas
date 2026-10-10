export type EstadoPedido =
  | { tipo: 'sem-evento'; eventosDisponiveis: number }
  | { tipo: 'evento-encerrado' }
  | { tipo: 'sem-saldo'; saldo: number; saldoOutroEvento?: number }
  | { tipo: 'sem-produtos'; saldo: number }
  | { tipo: 'pronto'; produtos: number }
  | { tipo: 'erro-carregamento' };

export function calcularEstadoPedido(input: {
  eventId: string;
  eventoStatus?: string | null;
  eventoWindowOpen?: boolean;
  saldo: number | null;
  produtosCount: number;
  erroCarregamento: boolean;
  eventosPossiveis: number;
  loadingProdutos?: boolean;
}): EstadoPedido {
  if (input.erroCarregamento) {
    return { tipo: 'erro-carregamento' };
  }

  if (!input.eventId) {
    return { tipo: 'sem-evento', eventosDisponiveis: input.eventosPossiveis };
  }

  if (input.eventoStatus === 'closed') {
    return { tipo: 'evento-encerrado' };
  }

  const saldo = input.saldo ?? 0;
  const produtos = input.produtosCount;

  if (produtos > 0) {
    return saldo > 0 ? { tipo: 'pronto', produtos } : { tipo: 'sem-saldo', saldo };
  }

  return { tipo: 'sem-produtos', saldo };
}
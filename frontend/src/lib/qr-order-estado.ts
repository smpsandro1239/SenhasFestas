export interface SaldoOutroEvento {
  saldo: number;
  nomeEvento: string;
}

export type EstadoPedido =
  | { tipo: 'sem-evento'; eventosDisponiveis: number }
  | { tipo: 'evento-encerrado' }
  | { tipo: 'carregando' }
  | { tipo: 'sem-saldo'; saldo: number; saldoOutroEvento?: SaldoOutroEvento }
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
  saldoOutroEvento?: SaldoOutroEvento | null;
}): EstadoPedido {
  if (input.erroCarregamento) {
    return { tipo: 'erro-carregamento' };
  }

  if (!input.eventId) {
    return { tipo: 'sem-evento', eventosDisponiveis: input.eventosPossiveis };
  }

  // `status` e a janela de datas sao avisos independentes: um evento pode estar
  // marcado como active e a janela ja ter fechado (endDate + 1 dia as 06:00).
  if (input.eventoStatus === 'closed' || input.eventoWindowOpen === false) {
    return { tipo: 'evento-encerrado' };
  }

  // Enquanto o menu nao chega, nao se decide entre sem-saldo/sem-produtos: sem
  // isto a pagina mostrava "menu indisponivel" durante o carregamento.
  if (input.loadingProdutos) {
    return { tipo: 'carregando' };
  }

  const saldo = input.saldo ?? 0;
  const produtos = input.produtosCount;

  if (produtos > 0) {
    return saldo > 0
      ? { tipo: 'pronto', produtos }
      : {
          tipo: 'sem-saldo',
          saldo,
          ...(input.saldoOutroEvento ? { saldoOutroEvento: input.saldoOutroEvento } : {}),
        };
  }

  return { tipo: 'sem-produtos', saldo };
}

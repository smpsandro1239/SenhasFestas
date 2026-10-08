import { isEventWindowOpen } from './event-window';

export interface EventoParaSelecao {
  id: string;
  name?: string;
  status: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

export function selecionarEventoId(
  events: EventoParaSelecao[],
  urlEventId: string | null,
): string | null {
  if (urlEventId && events.some((e) => e.id === urlEventId)) {
    return urlEventId;
  }
  if (events.length === 1) {
    return events[0].id;
  }
  const ativo = events.find((e) => e.status === 'active');
  return ativo?.id ?? events[0]?.id ?? null;
}

/** Eventos ativos E com a janela de datas aberta (réplica do critério do backend). */
export function eventosDisponiveis(
  events: EventoParaSelecao[],
  agora: Date = new Date(),
): EventoParaSelecao[] {
  return events.filter((e) => e.status === 'active' && isEventWindowOpen(e, agora));
}

/**
 * Escolha do evento para o /qr-order. Seleções explícitas (URL/código/manual)
 * ganham a qualquer evento do utilizador — mesmo encerrado, para a página
 * mostrar o devido aviso. Sem escolha explícita: auto-seleciona quando há
 * exatamente um disponível; com mais de um, devolve null (mostrar dropdown).
 */
export function escolherEventoId(
  events: EventoParaSelecao[],
  idExplicito: string | null,
  agora: Date = new Date(),
): string | null {
  if (idExplicito && events.some((e) => e.id === idExplicito)) {
    return idExplicito;
  }
  const disponiveis = eventosDisponiveis(events, agora);
  if (disponiveis.length === 1) {
    return disponiveis[0].id;
  }
  return null;
}
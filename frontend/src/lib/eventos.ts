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

/**
 * Oportunidades do /qr-order: membros ativos+janeira unidos com a lista
 * pública (backend pré-filtrada por ativos+janeira — sem status na payload,
 * por isso os públicos não passam por eventosDisponiveis). Dedup por id.
 */
export interface EventoPossivel {
  id: string;
  name?: string;
  shortCode?: string;
}

export function eventosPossiveis(
  membros: EventoParaSelecao[],
  publicos: EventoPossivel[],
  agora: Date = new Date(),
): EventoPossivel[] {
  const vistos = new Set<string>();
  const lista: EventoPossivel[] = [];
  for (const evento of [...eventosDisponiveis(membros, agora), ...publicos]) {
    if (vistos.has(evento.id)) continue;
    vistos.add(evento.id);
    lista.push(evento);
  }
  return lista;
}

/** Escolher um evento que não é de um dos membros exige entrar (vincularCliente). */
export function requerEntrada(eventId: string, membros: EventoParaSelecao[]): boolean {
  return !membros.some((e) => e.id === eventId);
}
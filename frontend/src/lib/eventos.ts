export interface EventoParaSelecao {
  id: string;
  status: string;
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
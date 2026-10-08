'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEvents } from './api';
import { selecionarEventoId, type EventoParaSelecao } from './eventos';

export interface EventItem extends EventoParaSelecao {
  [key: string]: unknown;
}

export function useCurrentEvent(): {
  event: EventItem | null;
  events: EventItem[];
  loading: boolean;
  error: string;
} {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('event');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getEvents()
      .then((list: EventItem[]) => {
        if (cancelled) return;
        const visiveis = list.filter((e) => e.status === 'active');
        const eventos = visiveis.length ? visiveis : list;
        setEvents(eventos);
        setSelectedId(selecionarEventoId(eventos, urlEventId));
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar os eventos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlEventId]);

  const event = events.find((e) => e.id === selectedId) ?? null;

  return { event, events, loading, error };
}
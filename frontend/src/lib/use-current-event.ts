'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEvents } from './api';

export interface EventItem {
  id: string;
  name: string;
  status: string;
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
        const active = list.filter((e) => e.status === 'active');
        setEvents(active.length ? active : list);
        const preferred =
          arrayHas(urlEventId, list) ? urlEventId : active[0]?.id ?? list[0]?.id ?? null;
        setSelectedId(preferred ?? (list[0]?.id ?? null));
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

function arrayHas(id: string | null, list: EventItem[]): boolean {
  if (!id) return false;
  return list.some((e) => e.id === id);
}
'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

export function useOrderSocket(refetch: () => void, eventId?: string | null): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!rawUrl || !eventId) {
      return;
    }
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') ?? '' : '';
    const socket: Socket = io(rawUrl.replace(/\/+$/, ''), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 8000,
      timeout: 5000,
    });

    const entrarNoEvento = () => socket.emit('joinEvent', eventId);
    socket.on('connect', entrarNoEvento);
    socket.on('reconnect', entrarNoEvento);
    socket.on('orderUpdated', () => refetchRef.current());
    socket.on('error', () => undefined);

    return () => {
      socket.disconnect();
    };
  }, [eventId]);
}
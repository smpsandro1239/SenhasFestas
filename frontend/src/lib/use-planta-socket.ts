'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';
import type { EventoPlantaRemota } from './planta';

/**
 * Liga ao canal de planta do evento. O backend só deixa entrar
 * quem tem `MANAGEMENT_ROLES` (`joinEventPlanta`); sem permissão o servidor emite
 * `error` e o cliente simplesmente não recebe updates (o 409 HTTP continua a ser
 * a rede de segurança).
 */
export function usePlantaSocket(
  eventId: string | null | undefined,
  onPlantaUpdated: (evento: EventoPlantaRemota) => void,
): void {
  const callbackRef = useRef(onPlantaUpdated);
  callbackRef.current = onPlantaUpdated;

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!rawUrl || !eventId) {
      return;
    }

    const socket: Socket = io(rawUrl.replace(/\/+$/, ''), {
      auth: { token: getAccessToken() ?? '' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 5000,
    });

    const entrar = () => socket.emit('joinEventPlanta', eventId);

    socket.on('connect', entrar);
    socket.on('reconnect', entrar);
    socket.on('plantaUpdated', (payload: EventoPlantaRemota) => {
      if (!payload || typeof payload.plantaId !== 'string') return;
      callbackRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId]);
}

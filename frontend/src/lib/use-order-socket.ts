'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, ensureFreshToken } from './api';

export type OrderSocketStatus = 'disabled' | 'connected' | 'reconnecting' | 'offline';

export function criarSocketAutenticado(options: {
  url: string;
  eventId: string;
  onStatus: (status: OrderSocketStatus) => void;
  onOrderUpdated: () => void;
}): Socket {
  const { url, eventId, onStatus, onOrderUpdated } = options;

  const socket: Socket = io(url, {
    auth: { token: getAccessToken() ?? '' },
    transports: ['websocket'],
    // Decisão: reconexão infinita com backoff. Um blip de rede (ex.: 30s) não
    // pode matar o KDS — quando a rede volta, o badge volta a "Ligado" sozinho.
    // O polling HTTP (3s/5s) é a rede de segurança; o socket é a camada rápida.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 5000,
  });

  const entrarNoEvento = () => socket.emit('joinEvent', eventId);

  socket.on('connect', () => {
    onStatus('connected');
    entrarNoEvento();
  });
  socket.on('reconnect', entrarNoEvento);
  socket.on('orderUpdated', () => onOrderUpdated());
  socket.on('disconnect', () => onStatus('reconnecting'));

  // error (pós-conexão) é distinto de connect_error (falha de handshake):
  // sem handler, voltaria a ser um erro silencioso — expõe o estado em vez disso.
  socket.on('error', () => onStatus('reconnecting'));

  socket.on('connect_error', () => {
    onStatus('reconnecting');
    void (async () => {
      const ok = await ensureFreshToken();
      const novoToken = getAccessToken();
      if (ok && novoToken) {
        socket.auth = { token: novoToken };
        socket.connect();
      } else {
        onStatus('offline');
      }
    })();
  });

  socket.connect();
  return socket;
}

export function useOrderSocket(
  refetch: () => void,
  eventId?: string | null,
): { status: OrderSocketStatus } {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const [status, setStatus] = useState<OrderSocketStatus>('disabled');

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!rawUrl || !eventId) {
      return;
    }

    const socket = criarSocketAutenticado({
      url: rawUrl.replace(/\/+$/, ''),
      eventId,
      onStatus: setStatus,
      onOrderUpdated: () => refetchRef.current(),
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId]);

  return { status };
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { criarSocketAutenticado, type OrderSocketStatus } from './use-order-socket';
import type { EventoPlantaRemota } from './planta';
import { EVENTOS_SOCKET, MENSAGENS_ENTRADA } from '@senhasfestas/shared';

/**
 * Liga ao canal de planta do evento. O backend só deixa entrar
 * quem tem `MANAGEMENT_ROLES` (`joinEventPlanta`); sem permissão o servidor emite
 * `error` e o cliente simplesmente não recebe updates (o 409 HTTP continua a ser
 * a rede de segurança).
 *
 * Devolve o `status` de ligação (igual ao de `useOrderSocket`) para o badge — sem
 * ele o utilizador só descobria o realtime em baixo pelo 409.
 */
export function usePlantaSocket(
  eventId: string | null | undefined,
  onPlantaUpdated: (evento: EventoPlantaRemota) => void,
): { status: OrderSocketStatus } {
  const callbackRef = useRef(onPlantaUpdated);
  callbackRef.current = onPlantaUpdated;
  const [status, setStatus] = useState<OrderSocketStatus>('disabled');

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!rawUrl || !eventId) {
      return;
    }

    const socket = criarSocketAutenticado({
      url: rawUrl.replace(/\/+$/, ''),
      eventId,
      roomEvent: MENSAGENS_ENTRADA.planta,
      mensagem: EVENTOS_SOCKET.plantaUpdated,
      onStatus: setStatus,
      onMessage: (payload) => {
        const evento = payload as EventoPlantaRemota | null;
        if (!evento || typeof evento.plantaId !== 'string') return;
        callbackRef.current(evento);
      },
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId]);

  return { status };
}

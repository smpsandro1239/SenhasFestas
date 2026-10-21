/**
 * Contrato de realtime partilhado entre o backend (Socket.IO) e o frontend.
 *
 * Sem um pacote comum, o tipo `TipoAlteracaoPlanta` era definido duas vezes
 * (backend e frontend) e uma divergência só apareceria em runtime. Isto é a
 * fonte única desses símbolos do protocolo.
 */

/** Tipo de alteração que gerou um `plantaUpdated`. `renomeada`/`apagada` não mudam a `version`. */
export type TipoAlteracaoPlanta = 'criada' | 'guardada' | 'renomeada' | 'apagada';

/** Payload público do evento `plantaUpdated` (o documento é obtido por HTTP, não vai no evento). */
export interface PlantaUpdatedPayload {
  plantaId: string;
  version: number;
  tipo: TipoAlteracaoPlanta;
}

/** Payload público do evento `orderUpdated`. */
export interface OrderUpdatedPayload {
  orderId: string;
  status: string;
}

/** Canais Redis de fan-out (publicados/subscrevidos pelo gateway). */
export const CANAIS_REALTIME = {
  pedidos: 'order:updates',
  planta: 'planta:updates',
} as const;

/** Nomes dos eventos Socket.IO emitidos para os clientes. */
export const EVENTOS_SOCKET = {
  plantaUpdated: 'plantaUpdated',
  orderUpdated: 'orderUpdated',
} as const;

/** Nomes das mensagens Socket.IO que os clientes enviam para entrar numa room. */
export const MENSAGENS_ENTRADA = {
  evento: 'joinEvent',
  planta: 'joinEventPlanta',
} as const;

/** Room geral do evento (pedidos). */
export function roomEvento(eventId: string): string {
  return `event:${eventId}`;
}

/** Room restrita à planta do evento (só `MANAGEMENT_ROLES`). */
export function roomPlanta(eventId: string): string {
  return `event:${eventId}:planta`;
}

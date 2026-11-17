export type OrderIdempotencyOutcome = 'success' | 'definitive-error' | 'ambiguous-error';

export interface OrderIdempotencyContext {
  key: string;
  memoryKey: string;
  storageKey?: string;
  inFlight: number;
  successObserved: boolean;
  ambiguousFailure: boolean;
}

const inMemoryKeys = new Map<string, OrderIdempotencyContext | Promise<OrderIdempotencyContext>>();
const STORAGE_PREFIX = 'senhasfestas:order-idempotency:';

function createRandomKey(): string {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : undefined;
  try {
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
    if (cryptoApi?.getRandomValues) {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(24));
      return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* O armazenamento em memória continua a proteger retries nesta página. */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function criarContexto(serialized: string, memoryKey: string): Promise<OrderIdempotencyContext> {
  let storageKey: string | undefined;
  let key: string | undefined;

  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const digest = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(serialized),
      );
      const fingerprint = Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      storageKey = `${STORAGE_PREFIX}${fingerprint}`;
      key = window.sessionStorage.getItem(storageKey) ?? undefined;
    } catch {
      /* WebCrypto ou sessionStorage indisponível: usar o fallback em memória. */
      storageKey = undefined;
    }
  }

  if (!key) key = createRandomKey();
  const context: OrderIdempotencyContext = {
    key,
    memoryKey,
    storageKey,
    inFlight: 0,
    successObserved: false,
    ambiguousFailure: false,
  };

  if (storageKey && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(storageKey, key);
    } catch {
      /* A chave permanece em memória até o resultado do pedido ser conhecido. */
    }
  }

  return context;
}

/**
 * Reutiliza a mesma chave entre retries do mesmo payload, incluindo submissões
 * concorrentes. O payload só existe como chave do Map em memória.
 */
export async function getOrderIdempotencyContext(data: unknown): Promise<OrderIdempotencyContext> {
  const serialized = JSON.stringify(data) ?? 'null';
  const memoryKey = serialized;
  const cached = inMemoryKeys.get(memoryKey);
  if (cached) {
    const context = await cached;
    context.inFlight += 1;
    return context;
  }

  const pending = criarContexto(serialized, memoryKey).then((context) => {
    if (inMemoryKeys.get(memoryKey) === pending) {
      inMemoryKeys.set(memoryKey, context);
    }
    return context;
  }).catch((error) => {
    if (inMemoryKeys.get(memoryKey) === pending) {
      inMemoryKeys.delete(memoryKey);
    }
    throw error;
  });

  inMemoryKeys.set(memoryKey, pending);
  const context = await pending;
  context.inFlight += 1;
  return context;
}

export function clearOrderIdempotencyContext(context: OrderIdempotencyContext): void {
  const current = inMemoryKeys.get(context.memoryKey);
  if (current === context) inMemoryKeys.delete(context.memoryKey);

  if (context.storageKey && typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(context.storageKey) === context.key) {
        window.sessionStorage.removeItem(context.storageKey);
      }
    } catch {
      /* O storage é opcional; não pode impedir o tratamento da resposta da API. */
    }
  }
}

/**
 * Só limpa a chave quando todas as tentativas concorrentes terminaram.
 * Um erro ambíguo mantém a chave disponível para retry, salvo se outra tentativa
 * com a mesma chave já confirmou o pedido.
 */
export function releaseOrderIdempotencyContext(
  context: OrderIdempotencyContext,
  outcome: OrderIdempotencyOutcome,
): void {
  if (context.inFlight > 0) context.inFlight -= 1;
  if (outcome === 'success') context.successObserved = true;
  if (outcome === 'ambiguous-error') context.ambiguousFailure = true;

  if (
    context.inFlight === 0 &&
    (context.successObserved || !context.ambiguousFailure)
  ) {
    clearOrderIdempotencyContext(context);
  }
}

export interface OrderIdempotencyContext {
  key: string;
  memoryKey: string;
  storageKey?: string;
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

/**
 * Reutiliza uma chave entre retries do mesmo payload.
 * O payload só existe como chave de Map em memória; nunca é persistido no storage.
 */
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
  const context: OrderIdempotencyContext = { key, memoryKey, storageKey };

  if (storageKey && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(storageKey, key);
    } catch {
      /* A chave permanece em memória até o resultado do pedido ser conhecido. */
    }
  }

  return context;
}

/** Reutiliza a mesma chave mesmo quando várias submissões começam em paralelo. */
export async function getOrderIdempotencyContext(data: unknown): Promise<OrderIdempotencyContext> {
  const serialized = JSON.stringify(data) ?? 'null';
  const memoryKey = serialized;
  const cached = inMemoryKeys.get(memoryKey);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
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
  return pending;
}

export function clearOrderIdempotencyContext(context: OrderIdempotencyContext): void {
  const current = inMemoryKeys.get(context.memoryKey);
  if (current && !(current instanceof Promise) && current.key === context.key) {
    inMemoryKeys.delete(context.memoryKey);
  }

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

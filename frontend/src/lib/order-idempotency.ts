export interface OrderIdempotencyContext {
  key: string;
  memoryKey: string;
  storageKey?: string;
}

interface InMemoryEntry {
  promise: Promise<OrderIdempotencyContext>;
  context?: OrderIdempotencyContext;
}

const inMemoryKeys = new Map<string, InMemoryEntry>();
const STORAGE_PREFIX = 'senhasfestas:order-idempotency:';

function createRandomKey(): string {
  try {
    const cryptoApi = typeof window !== 'undefined' ? window.crypto : undefined;
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
 *
 * A Promise é colocada no Map antes de iniciar WebCrypto/storage. Assim, dois
 * cliques concorrentes para o mesmo payload aguardam a mesma chave, em vez de
 * gerarem chaves diferentes enquanto o digest ainda está pendente.
 */
export function getOrderIdempotencyContext(data: unknown): Promise<OrderIdempotencyContext> {
  const serialized = JSON.stringify(data) ?? 'null';
  const memoryKey = serialized;
  const cached = inMemoryKeys.get(memoryKey);
  if (cached) return cached.promise;

  let entry: InMemoryEntry;
  const promise = Promise.resolve().then(async () => {
    let storageKey: string | undefined;
    let key: string | undefined;

    try {
      const cryptoApi = typeof window !== 'undefined' ? window.crypto : undefined;
      if (cryptoApi?.subtle?.digest) {
        const digest = await cryptoApi.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(serialized),
        );
        const fingerprint = Array.from(new Uint8Array(digest))
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('');
        storageKey = `${STORAGE_PREFIX}${fingerprint}`;
        key = window.sessionStorage.getItem(storageKey) ?? undefined;
      }
    } catch {
      /* WebCrypto ou sessionStorage indisponível: usar o fallback em memória. */
      storageKey = undefined;
      key = undefined;
    }

    if (!key) key = createRandomKey();
    const context: OrderIdempotencyContext = { key, memoryKey, storageKey };
    entry.context = context;

    if (storageKey && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(storageKey, key);
      } catch {
        /* A chave permanece em memória até o resultado do pedido ser conhecido. */
      }
    }

    return context;
  });

  entry = { promise };
  inMemoryKeys.set(memoryKey, entry);
  void promise.catch(() => {
    if (inMemoryKeys.get(memoryKey) === entry) inMemoryKeys.delete(memoryKey);
  });
  return promise;
}

export function clearOrderIdempotencyContext(context: OrderIdempotencyContext): void {
  const current = inMemoryKeys.get(context.memoryKey);
  if (current?.context?.key === context.key) inMemoryKeys.delete(context.memoryKey);

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

export type BalanceIdempotencyOutcome = 'success' | 'definitive-error' | 'ambiguous-error';

export interface BalanceIdempotencyContext {
  key: string;
  memoryKey: string;
  storageKey?: string;
  inFlight: number;
  successObserved: boolean;
  ambiguousFailure: boolean;
}

const contexts = new Map<string, BalanceIdempotencyContext | Promise<BalanceIdempotencyContext>>();
const STORAGE_PREFIX = 'senhasfestas:balance-idempotency:';

function randomKey(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(24)), (v) => v.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* O fallback em memória continua disponível. */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function createContext(serialized: string): Promise<BalanceIdempotencyContext> {
  let storageKey: string | undefined;
  let key: string | undefined;
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
      const fingerprint = Array.from(new Uint8Array(digest))
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
      storageKey = `${STORAGE_PREFIX}${fingerprint}`;
      key = window.sessionStorage.getItem(storageKey) ?? undefined;
    } catch {
      storageKey = undefined;
    }
  }
  if (!key) key = randomKey();
  const context: BalanceIdempotencyContext = {
    key,
    memoryKey: serialized,
    storageKey,
    inFlight: 0,
    successObserved: false,
    ambiguousFailure: false,
  };
  if (storageKey && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(storageKey, key);
    } catch {
      /* O armazenamento é opcional. */
    }
  }
  return context;
}

export async function getBalanceIdempotencyContext(data: unknown): Promise<BalanceIdempotencyContext> {
  const serialized = JSON.stringify(data) ?? 'null';
  const cached = contexts.get(serialized);
  if (cached) {
    const context = await cached;
    context.inFlight += 1;
    return context;
  }
  const pending = createContext(serialized).then((context) => {
    if (contexts.get(serialized) === pending) contexts.set(serialized, context);
    return context;
  }).catch((error) => {
    if (contexts.get(serialized) === pending) contexts.delete(serialized);
    throw error;
  });
  contexts.set(serialized, pending);
  const context = await pending;
  context.inFlight += 1;
  return context;
}

function clearContext(context: BalanceIdempotencyContext): void {
  if (contexts.get(context.memoryKey) === context) contexts.delete(context.memoryKey);
  if (context.storageKey && typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(context.storageKey) === context.key) {
        window.sessionStorage.removeItem(context.storageKey);
      }
    } catch {
      /* O armazenamento é opcional. */
    }
  }
}

export function releaseBalanceIdempotencyContext(
  context: BalanceIdempotencyContext,
  outcome: BalanceIdempotencyOutcome,
): void {
  if (context.inFlight > 0) context.inFlight -= 1;
  if (outcome === 'success') context.successObserved = true;
  if (outcome === 'ambiguous-error') context.ambiguousFailure = true;
  if (context.inFlight === 0 && (context.successObserved || !context.ambiguousFailure)) {
    clearContext(context);
  }
}

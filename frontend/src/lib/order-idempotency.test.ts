// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearOrderIdempotencyContext,
  getOrderIdempotencyContext,
  releaseOrderIdempotencyContext,
  type OrderIdempotencyContext,
} from './order-idempotency';

const contexts: OrderIdempotencyContext[] = [];

afterEach(() => {
  contexts.splice(0).forEach(clearOrderIdempotencyContext);
  vi.restoreAllMocks();
});

describe('chaves de idempotência do POS', () => {
  it('reutiliza a mesma chave entre retries quando WebCrypto e sessionStorage falham', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `fallback-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const payload = { eventId: 'event-1', items: [{ productId: 'p1', quantity: 2 }] };
    const first = await getOrderIdempotencyContext(payload);
    contexts.push(first);
    const retry = await getOrderIdempotencyContext(payload);
    contexts.push(retry);

    expect(retry.key).toBe(first.key);
    expect(sequence).toBe(1);
  });

  it('gera uma chave nova depois de limpar uma operação concluída', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `order-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const payload = { eventId: 'event-1', items: [{ productId: 'p1', quantity: 1 }] };
    const first = await getOrderIdempotencyContext(payload);
    contexts.push(first);
    clearOrderIdempotencyContext(first);
    const next = await getOrderIdempotencyContext(payload);
    contexts.push(next);

    expect(next.key).not.toBe(first.key);
    expect(sequence).toBe(2);
  });

  it('não reutiliza a chave para payloads diferentes', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `order-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const first = await getOrderIdempotencyContext({ eventId: 'event-1' });
    const second = await getOrderIdempotencyContext({ eventId: 'event-2' });
    contexts.push(first, second);

    expect(first.key).not.toBe(second.key);
  });
  it('partilha a mesma chave entre submissões concorrentes do mesmo payload', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `parallel-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const payload = { eventId: 'event-1', items: [{ productId: 'p1', quantity: 1 }] };
    const [first, second] = await Promise.all([
      getOrderIdempotencyContext(payload),
      getOrderIdempotencyContext(payload),
    ]);
    contexts.push(first, second);

    expect(second.key).toBe(first.key);
    expect(sequence).toBe(1);
  });

  it('mantém a chave até terminarem retries concorrentes, incluindo um erro ambíguo', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `lifecycle-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const payload = { eventId: 'event-1', items: [{ productId: 'p1', quantity: 1 }] };
    const [first, second] = await Promise.all([
      getOrderIdempotencyContext(payload),
      getOrderIdempotencyContext(payload),
    ]);
    contexts.push(first, second);

    releaseOrderIdempotencyContext(first, 'success');
    const retry = await getOrderIdempotencyContext(payload);
    contexts.push(retry);
    expect(retry.key).toBe(first.key);

    releaseOrderIdempotencyContext(second, 'ambiguous-error');
    releaseOrderIdempotencyContext(retry, 'success');

    const nextOrder = await getOrderIdempotencyContext(payload);
    contexts.push(nextOrder);
    expect(nextOrder.key).not.toBe(first.key);
    expect(sequence).toBe(2);
  });

  it('preserva a chave após falha ambígua até um retry confirmar o pedido', async () => {
    let sequence = 0;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => `retry-key-${++sequence}`) },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        setItem: vi.fn(() => { throw new Error('storage indisponível'); }),
        removeItem: vi.fn(),
      },
    });

    const payload = { eventId: 'event-1', items: [{ productId: 'p1', quantity: 1 }] };
    const first = await getOrderIdempotencyContext(payload);
    contexts.push(first);
    releaseOrderIdempotencyContext(first, 'ambiguous-error');

    const retry = await getOrderIdempotencyContext(payload);
    contexts.push(retry);
    expect(retry.key).toBe(first.key);
    releaseOrderIdempotencyContext(retry, 'success');

    expect(sequence).toBe(1);
  });

});

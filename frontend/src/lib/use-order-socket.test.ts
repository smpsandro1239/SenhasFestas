import { describe, it, expect, vi, beforeEach } from 'vitest';
import { io } from 'socket.io-client';
import { criarSocketAutenticado } from './use-order-socket';
import { getAccessToken, ensureFreshToken } from './api';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('./api', () => ({
  getAccessToken: vi.fn(),
  ensureFreshToken: vi.fn(),
}));

interface FakeSocket {
  auth: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  handlers: Record<string, Array<(...args: any[]) => void>>;
}

function novoFakeSocket(): FakeSocket {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  const fake: FakeSocket = {
    auth: {},
    on: vi.fn((ev: string, cb: (...args: any[]) => void) => {
      handlers[ev] ??= [];
      handlers[ev].push(cb);
      return fake;
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    handlers,
  };
  return fake;
}

async function disparar(socket: FakeSocket, evento: string, ...args: any[]) {
  for (const cb of socket.handlers[evento] ?? []) {
    await cb(...args);
  }
}

describe('criarSocketAutenticado (A10: WS re-autentica e expõe erros)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lê o token fresco do getter ao criar o socket (não captura no mount)', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    (getAccessToken as any).mockReturnValue('token-fresco');

    criarSocketAutenticado({ url: 'ws://x', eventId: 'e1', onStatus: vi.fn(), onOrderUpdated: vi.fn() });

    expect(io).toHaveBeenCalledWith(
      'ws://x',
      expect.objectContaining({ auth: { token: 'token-fresco' } }),
    );
    expect(socket.connect).toHaveBeenCalled();
  });

  it('em connect_error: faz refresh e re-autentica com o token novo', async () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    (getAccessToken as any)
      .mockReturnValueOnce('token-velho')
      .mockReturnValueOnce('token-novo');
    (ensureFreshToken as any).mockResolvedValue(true);

    criarSocketAutenticado({ url: 'ws://x', eventId: 'e1', onStatus: vi.fn(), onOrderUpdated: vi.fn() });
    await disparar(socket, 'connect_error');

    expect(ensureFreshToken).toHaveBeenCalledTimes(1);
    expect(socket.auth).toEqual({ token: 'token-novo' });
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it('se o refresh falhar, expõe offline em vez de engolir o erro', async () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    (getAccessToken as any).mockReturnValue('token-velho');
    (ensureFreshToken as any).mockResolvedValue(false);
    const onStatus = vi.fn();

    criarSocketAutenticado({ url: 'ws://x', eventId: 'e1', onStatus, onOrderUpdated: vi.fn() });
    await disparar(socket, 'connect_error');

    expect(onStatus).toHaveBeenCalledWith('offline');
  });

  it('marca connected no connect e re-entra no evento', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    (getAccessToken as any).mockReturnValue('token');
    const onStatus = vi.fn();

    criarSocketAutenticado({ url: 'ws://x', eventId: 'e1', onStatus, onOrderUpdated: vi.fn() });
    disparar(socket, 'connect');

    expect(onStatus).toHaveBeenCalledWith('connected');
    expect(socket.emit).toHaveBeenCalledWith('joinEvent', 'e1');
  });
});
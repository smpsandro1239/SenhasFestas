// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import { usePlantaSocket } from './use-planta-socket';
import { getAccessToken } from './api';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('./api', () => ({
  getAccessToken: vi.fn(),
  ensureFreshToken: vi.fn().mockResolvedValue(false),
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

function disparar(socket: FakeSocket, evento: string, ...args: any[]) {
  for (const cb of socket.handlers[evento] ?? []) {
    cb(...args);
  }
}

function SocketHost({
  eventId,
  onPlantaUpdated,
  onStatus,
}: {
  eventId: string | null;
  onPlantaUpdated: (e: any) => void;
  onStatus?: (s: string) => void;
}) {
  const { status } = usePlantaSocket(eventId, onPlantaUpdated);
  onStatus?.(status);
  return null;
}

describe('usePlantaSocket (contrato do canal de planta)', () => {
  const URL_ORIG = process.env.NEXT_PUBLIC_WS_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_WS_URL = 'ws://api.test';
    (getAccessToken as any).mockReturnValue('token-abc');
  });

  afterEach(() => {
    cleanup();
    if (URL_ORIG === undefined) delete process.env.NEXT_PUBLIC_WS_URL;
    else process.env.NEXT_PUBLIC_WS_URL = URL_ORIG;
  });

  it('liga com o token actual e entra na planta no connect', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);

    render(<SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} />);

    expect(io).toHaveBeenCalledWith(
      'ws://api.test',
      expect.objectContaining({ auth: { token: 'token-abc' }, transports: ['websocket'] }),
    );
    disparar(socket, 'connect');
    expect(socket.emit).toHaveBeenCalledWith('joinEventPlanta', 'evt1');
  });

  it('re-entra na planta no reconnect (não fica fora após blip)', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);

    render(<SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} />);
    disparar(socket, 'reconnect');

    expect(socket.emit).toHaveBeenCalledWith('joinEventPlanta', 'evt1');
  });

  it('reemite plantaUpdated válido para o callback', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    const cb = vi.fn();

    render(<SocketHost eventId="evt1" onPlantaUpdated={cb} />);
    disparar(socket, 'plantaUpdated', { plantaId: 'p1', version: 7, tipo: 'guardada' });

    expect(cb).toHaveBeenCalledWith({ plantaId: 'p1', version: 7, tipo: 'guardada' });
  });

  it('ignora payload malformado (sem plantaId)', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    const cb = vi.fn();

    render(<SocketHost eventId="evt1" onPlantaUpdated={cb} />);
    disparar(socket, 'plantaUpdated', { version: 7 });
    disparar(socket, 'plantaUpdated', null);

    expect(cb).not.toHaveBeenCalled();
  });

  it('usa sempre o callback mais recente, sem re-criar o socket', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { rerender } = render(<SocketHost eventId="evt1" onPlantaUpdated={cb1} />);
    rerender(<SocketHost eventId="evt1" onPlantaUpdated={cb2} />);
    disparar(socket, 'plantaUpdated', { plantaId: 'p1', version: 1, tipo: 'guardada' });

    expect(io).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('desliga no unmount', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);

    const { unmount } = render(<SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} />);
    unmount();

    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('sem eventId não abre socket', () => {
    render(<SocketHost eventId={null} onPlantaUpdated={vi.fn()} />);
    expect(io).not.toHaveBeenCalled();
  });

  it('sem NEXT_PUBLIC_WS_URL não abre socket', () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    render(<SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} />);
    expect(io).not.toHaveBeenCalled();
  });

  it('status começa em disabled e passa a connected no connect (badge de ligação)', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    const estados: string[] = [];

    render(
      <SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} onStatus={(s) => estados.push(s)} />,
    );
    expect(estados.at(-1)).toBe('disabled');

    act(() => {
      disparar(socket, 'connect');
    });
    expect(estados.at(-1)).toBe('connected');
  });

  it('status passa a reconnecting no disconnect (realtime em baixo visível)', () => {
    const socket = novoFakeSocket();
    (io as any).mockReturnValue(socket);
    const estados: string[] = [];

    render(
      <SocketHost eventId="evt1" onPlantaUpdated={vi.fn()} onStatus={(s) => estados.push(s)} />,
    );
    act(() => {
      disparar(socket, 'connect');
      disparar(socket, 'disconnect');
    });
    expect(estados.at(-1)).toBe('reconnecting');
  });
});

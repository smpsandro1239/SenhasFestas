import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { redisInstancias } = vi.hoisted(() => ({ redisInstancias: [] as any[] }));

vi.mock('ioredis', () => {
  class RedisMock {
    handlers: Record<string, (...args: any[]) => void> = {};
    subscribe = vi.fn().mockResolvedValue(undefined);
    constructor() {
      redisInstancias.push(this);
    }
    on(evento: string, handler: (...args: any[]) => void) {
      this.handlers[evento] = handler;
      return this;
    }
    emit(evento: string, ...args: any[]) {
      this.handlers[evento]?.(...args);
    }
  }
  return { Redis: RedisMock, default: RedisMock };
});

import { OrderGateway } from './order.gateway';

function criarGateway(overrides: {
  redis?: any;
  membership?: any;
  config?: any;
  jwt?: any;
  users?: any;
} = {}) {
  const redisService = {
    publish: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    incrementWithTtl: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    ...overrides.redis,
  };
  const membershipService = {
    roleEfetiva: vi.fn(),
    assertMember: vi.fn(),
    ...overrides.membership,
  };
  const configService = {
    get: vi.fn().mockReturnValue(undefined),
    ...overrides.config,
  };
  const jwtService = {
    verify: vi.fn().mockImplementation(() => ({ sub: 'u1', role: 'organizer', exp: Math.floor(Date.now() / 1000) + 900 })),
    ...overrides.jwt,
  };
  const userRepository = {
    findOne: vi.fn().mockImplementation(({ where }: any) =>
      where?.isActive ? { id: where.id, role: 'organizer', isActive: true } : null,
    ),
    ...overrides.users,
  };

  const gateway = new OrderGateway(
    jwtService as any,
    configService as any,
    redisService as any,
    membershipService as any,
    userRepository as any,
  );
  return { gateway, redisService, membershipService, configService, jwtService, userRepository };
}

function socketFalso(user?: { id: string; role: string }) {
  return {
    id: 'sock-1',
    data: user ? { user } : {},
    emit: vi.fn(),
    join: vi.fn(),
    disconnect: vi.fn(),
    handshake: { auth: { token: 'bom' }, headers: {} },
  } as any;
}

function servidorFalso() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to, emit } as any, to, emit };
}

describe('OrderGateway — emissão local vs Redis (subscriberAtivo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emitOrderUpdate sem Redis emite localmente na room do evento e não publica', () => {
    const { gateway, redisService } = criarGateway();
    const { server, to, emit } = servidorFalso();
    gateway.server = server;

    gateway.emitOrderUpdate('o1', 'ready', 'evt1');

    expect(to).toHaveBeenCalledWith('event:evt1');
    expect(emit).toHaveBeenCalledWith('orderUpdated', { orderId: 'o1', status: 'ready' });
    expect(redisService.publish).not.toHaveBeenCalled();
  });

  it('emitOrderUpdate com subscriber ativo publica no Redis e não emite localmente', () => {
    const { gateway, redisService } = criarGateway();
    (gateway as any).subscriber = {};
    (gateway as any).subscriberAtivo = true;
    const { server, emit } = servidorFalso();
    gateway.server = server;

    gateway.emitOrderUpdate('o1', 'ready', 'evt1');

    expect(redisService.publish).toHaveBeenCalledWith('order:updates', expect.any(String));
    expect(emit).not.toHaveBeenCalled();
  });

  it('emitPlantaUpdate sem Redis emite localmente na room :planta com o tipo', () => {
    const { gateway, redisService } = criarGateway();
    const { server, to, emit } = servidorFalso();
    gateway.server = server;

    gateway.emitPlantaUpdate('evt1', 'p1', 3, 'renomeada');

    expect(to).toHaveBeenCalledWith('event:evt1:planta');
    expect(emit).toHaveBeenCalledWith('plantaUpdated', { plantaId: 'p1', version: 3, tipo: 'renomeada' });
    expect(redisService.publish).not.toHaveBeenCalled();
  });

  it('emitPlantaUpdate nunca emite na room geral do evento', () => {
    const { gateway } = criarGateway();
    const { server, to } = servidorFalso();
    gateway.server = server;

    gateway.emitPlantaUpdate('evt1', 'p1', 3, 'guardada');

    expect(to).toHaveBeenCalledWith('event:evt1:planta');
    expect(to).not.toHaveBeenCalledWith('event:evt1');
  });

  it('emitPlantaUpdate com subscriber ativo publica no canal de planta e não emite localmente', () => {
    const { gateway, redisService } = criarGateway();
    (gateway as any).subscriber = {};
    (gateway as any).subscriberAtivo = true;
    const { server, emit } = servidorFalso();
    gateway.server = server;

    gateway.emitPlantaUpdate('evt1', 'p1', 3, 'apagada');

    expect(redisService.publish).toHaveBeenCalledWith('planta:updates', expect.any(String));
    expect(emit).not.toHaveBeenCalled();
  });

  it('subscriberAtivo=false com subscriber definido (Redis em baixo) emite localmente', () => {
    const { gateway, redisService } = criarGateway();
    (gateway as any).subscriber = {};
    (gateway as any).subscriberAtivo = false;
    const { server, to } = servidorFalso();
    gateway.server = server;

    gateway.emitPlantaUpdate('evt1', 'p1', 1, 'guardada');

    expect(to).toHaveBeenCalledWith('event:evt1:planta');
    expect(redisService.publish).not.toHaveBeenCalled();
  });
});

describe('OrderGateway — revogação imediata de rooms por alteração de membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisInstancias.length = 0;
  });

  it('remove as rooms de pedidos e planta dos sockets locais do utilizador', () => {
    const { gateway, redisService } = criarGateway();
    const socketDoMembro = {
      data: { user: { id: 'u1', role: 'organizer' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    const socketDeOutro = {
      data: { user: { id: 'u2', role: 'organizer' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    gateway.server = {
      sockets: { sockets: new Map([['s1', socketDoMembro], ['s2', socketDeOutro]]) },
    } as any;

    gateway.revogarAcessoEvento('u1', 'evt1');

    expect(socketDoMembro.leave).toHaveBeenCalledWith('event:evt1');
    expect(socketDoMembro.leave).toHaveBeenCalledWith('event:evt1:planta');
    expect(socketDoMembro.emit).toHaveBeenCalledWith('membership:revoked', { eventId: 'evt1' });
    expect(socketDeOutro.leave).not.toHaveBeenCalled();
    expect(redisService.publish).not.toHaveBeenCalled();
  });

  it('propaga a revogação às restantes instâncias quando Redis está activo', () => {
    const { gateway, redisService } = criarGateway({
      config: { get: vi.fn().mockReturnValue('redis://localhost:6379') },
    });
    (gateway as any).subscriberAtivo = true;

    gateway.revogarAcessoEvento('u1', 'evt1');

    expect(redisService.publish).toHaveBeenCalledWith(
      'membership:revoked',
      JSON.stringify({ userId: 'u1', eventId: 'evt1' }),
    );
  });

  it('processa a mensagem Redis e remove as rooms na instância remota', () => {
    const { gateway } = criarGateway({
      config: { get: vi.fn().mockReturnValue('redis://localhost:6379') },
    });
    const socket = {
      data: { user: { id: 'u1', role: 'cashier' } },
      leave: vi.fn(),
      emit: vi.fn(),
    };
    gateway.server = { sockets: { sockets: new Map([['s1', socket]]) } } as any;

    redisInstancias[0].emit(
      'message',
      'membership:revoked',
      JSON.stringify({ userId: 'u1', eventId: 'evt1' }),
    );

    expect(socket.leave).toHaveBeenCalledWith('event:evt1');
    expect(socket.leave).toHaveBeenCalledWith('event:evt1:planta');
    expect(socket.emit).toHaveBeenCalledWith('membership:revoked', { eventId: 'evt1' });
  });
});

describe('OrderGateway — handleConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('desconecta quando falta o token', async () => {
    const { gateway } = criarGateway();
    const client = socketFalso();
    client.handshake = { auth: {}, headers: {} };

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('desconecta quando o token é inválido', async () => {
    const { gateway, jwtService } = criarGateway({
      jwt: { verify: vi.fn().mockImplementation(() => { throw new Error('jwt malformed'); }) },
    });
    const client = socketFalso();
    client.handshake = { auth: { token: 'mau' }, headers: {} };

    await gateway.handleConnection(client);

    expect(jwtService.verify).toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('aceita e regista o socket com token válido', async () => {
    const { gateway, jwtService } = criarGateway({
      jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', role: 'organizer', exp: Math.floor(Date.now() / 1000) + 900 }) },
    });
    const client = socketFalso();
    client.handshake = { auth: { token: 'bom' }, headers: {} };

    await gateway.handleConnection(client);

    expect(jwtService.verify).toHaveBeenCalled();
    expect(client.data.user).toEqual({ id: 'u1', role: 'organizer' });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejeita tokens sem expiração para não manter sockets indefinidos', async () => {
    const { gateway } = criarGateway({
      jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', role: 'organizer' }) },
    });
    const client = socketFalso();
    client.handshake = { auth: { token: 'sem-exp' }, headers: {} };

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('usa a role atual da BD e ignora uma role superadmin antiga no JWT', async () => {
    const { gateway } = criarGateway({
      jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', role: 'superadmin', exp: Math.floor(Date.now() / 1000) + 900 }) },
      users: { findOne: vi.fn().mockResolvedValue({ id: 'u1', role: 'organizer', isActive: true }) },
    });
    const client = socketFalso();
    client.handshake = { auth: { token: 'bom' }, headers: {} };

    await gateway.handleConnection(client);

    expect(client.data.user).toEqual({ id: 'u1', role: 'organizer' });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('desconecta utilizadores desativados mesmo com JWT válido', async () => {
    const { gateway } = criarGateway({
      jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', role: 'organizer' }) },
      users: { findOne: vi.fn().mockResolvedValue(null) },
    });
    const client = socketFalso();
    client.handshake = { auth: { token: 'bom' }, headers: {} };

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});

describe('OrderGateway — handleJoinEventPlanta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita não autenticado', async () => {
    const { gateway } = criarGateway();
    const client = socketFalso();
    client.handshake = { auth: {}, headers: {} };

    const resultado = await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(client.emit).toHaveBeenCalledWith('error', { message: 'Não autenticado' });
    expect(client.join).not.toHaveBeenCalled();
    expect(resultado).toEqual({ ok: false, message: 'Não autenticado' });
  });

  it('rejeita quem não pertence ao evento', async () => {
    const { gateway, membershipService } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockRejectedValue(new Error('Não pertence a este evento')) },
    });
    const client = socketFalso({ id: 'u1', role: 'kitchen' });
    const ack = await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(membershipService.roleEfetiva).toHaveBeenCalledWith(client.data.user, 'evt1');
    expect(client.emit).toHaveBeenCalledWith('error', { message: 'Não pertence a este evento' });
    expect(ack).toEqual({ ok: false, message: 'Não pertence a este evento' });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejeita um role operacional (kitchen) e não entra na room de planta', async () => {
    const { gateway } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockResolvedValue('kitchen') },
    });
    const client = socketFalso({ id: 'u1', role: 'kitchen' });

    await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Sem permissão para a planta deste evento',
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('aceita um organizer e entra na room event:<id>:planta', async () => {
    const { gateway } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockResolvedValue('organizer') },
    });
    // Simula a mensagem a chegar antes de handleConnection() terminar.
    const client = socketFalso();
    const ack = await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(client.data.user).toEqual({ id: 'u1', role: 'organizer' });
    expect(client.join).toHaveBeenCalledWith('event:evt1:planta');
    expect(ack).toEqual({ ok: true });
    expect(client.emit).not.toHaveBeenCalled();
  });

  it('aceita superadmin (roleEfetiva imune) e entra na room', async () => {
    const { gateway } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockResolvedValue('superadmin') },
    });
    const client = socketFalso({ id: 'u1', role: 'superadmin' });

    await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(client.join).toHaveBeenCalledWith('event:evt1:planta');
  });

  it('rejeita eventId inválido', async () => {
    const { gateway } = criarGateway();
    const client = socketFalso({ id: 'u1', role: 'organizer' });

    await gateway.handleJoinEventPlanta(client, '');

    expect(client.emit).toHaveBeenCalledWith('error', { message: 'eventId inválido' });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('verifica a membership antes do rate-limit (não-membro não consome tentativas)', async () => {
    const { gateway, redisService, membershipService } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockRejectedValue(new Error('Não pertence a este evento')) },
    });
    const client = socketFalso({ id: 'u1', role: 'kitchen' });

    await gateway.handleJoinEventPlanta(client, 'evt1');

    expect(membershipService.roleEfetiva).toHaveBeenCalled();
    expect(redisService.incrementWithTtl).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('error', { message: 'Não pertence a este evento' });
  });
});

describe('OrderGateway — wiring subscriberAtivo via Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisInstancias.length = 0;
  });

  function gatewayComRedis() {
    return criarGateway({ config: { get: vi.fn().mockReturnValue('redis://localhost:6379') } });
  }

  it('cria o subscriber quando REDIS_URL está definido e liga os handlers ready/end', () => {
    const { gateway } = gatewayComRedis();
    expect(redisInstancias).toHaveLength(1);
    expect(gateway['subscriber']).toBe(redisInstancias[0]);
    expect(gateway['subscriberAtivo']).toBe(false);
  });

  it('evento ready ativa distribuirViaRedis; evento end desativa', () => {
    const { gateway } = gatewayComRedis();
    const subscriber = redisInstancias[0];

    subscriber.emit('ready');
    expect(gateway['subscriberAtivo']).toBe(true);
    expect(gateway['distribuirViaRedis']).toBe(true);

    subscriber.emit('end');
    expect(gateway['subscriberAtivo']).toBe(false);
    expect(gateway['distribuirViaRedis']).toBe(false);
  });

  it('mensagem no canal de planta re-emite plantaUpdated com tipo na room :planta', () => {
    const { gateway } = gatewayComRedis();
    const { server, to, emit } = servidorFalso();
    gateway.server = server;
    const subscriber = redisInstancias[0];

    subscriber.emit(
      'message',
      'planta:updates',
      JSON.stringify({ eventId: 'evt1', plantaId: 'p1', version: 2, tipo: 'apagada' }),
    );

    expect(to).toHaveBeenCalledWith('event:evt1:planta');
    expect(emit).toHaveBeenCalledWith('plantaUpdated', { plantaId: 'p1', version: 2, tipo: 'apagada' });
  });

  it('sem REDIS_URL não cria subscriber nem consome o construtor', () => {
    const { gateway } = criarGateway();
    expect(gateway['subscriber']).toBeNull();
  });
});


describe('OrderGateway — confirmação de entrada na room de pedidos', () => {
  it('confirma a room apenas depois de validar a event-role staff', async () => {
    const { gateway, membershipService } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockResolvedValue('organizer') },
    });
    const client = socketFalso({ id: 'u1', role: 'organizer' });
    const ack = await gateway.handleJoinEvent(client, 'evt1');

    expect(membershipService.roleEfetiva).toHaveBeenCalledWith(client.data.user, 'evt1');
    expect(client.join).toHaveBeenCalledWith('event:evt1');
    expect(ack).toEqual({ ok: true });
  });

  it('devolve erro de confirmação quando a membership não existe', async () => {
    const { gateway } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockRejectedValue(new Error('Não pertence a este evento')) },
    });
    const client = socketFalso({ id: 'u1', role: 'organizer' });
    const ack = await gateway.handleJoinEvent(client, 'evt1');

    expect(client.join).not.toHaveBeenCalled();
    expect(ack).toEqual({ ok: false, message: 'Não pertence a este evento' });
  });

  it('impede clientes de receber actualizações de todos os pedidos do evento', async () => {
    const { gateway } = criarGateway({
      membership: { roleEfetiva: vi.fn().mockResolvedValue('client') },
    });
    const client = socketFalso({ id: 'u1', role: 'organizer' });
    const ack = await gateway.handleJoinEvent(client, 'evt1');

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Sem permissão para actualizações de pedidos deste evento',
    });
    expect(ack).toEqual({
      ok: false,
      message: 'Sem permissão para actualizações de pedidos deste evento',
    });
  });
});

import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { UserEntity } from '../entities';
import { RedisService } from '../common/redis/redis.service';
import { MembershipService } from '../common/membership.service';
import { MANAGEMENT_ROLES, STAFF_ROLES } from '../common/roles';
import {
  CANAIS_REALTIME,
  EVENTOS_SOCKET,
  MENSAGENS_ENTRADA,
  roomEvento,
  roomPlanta,
  type TipoAlteracaoPlanta,
} from '@senhasfestas/shared';

export type { TipoAlteracaoPlanta } from '@senhasfestas/shared';

const ORDER_STATUS_CACHE_TTL = 60 * 60 * 24;
const CHANNEL = CANAIS_REALTIME.pedidos;
const PLANTA_CHANNEL = CANAIS_REALTIME.planta;
const MEMBERSHIP_CHANNEL = 'membership:revoked';

const JOIN_WINDOW_MS = 60_000;
const JOIN_LIMIT = 10;
const MAX_SOCKETS_PER_USER = 3;

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (process.env.FRONTEND_URL || 'http://localhost:3001').split(',').map((o) => o.trim());
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origem não permitida'));
      }
    },
    credentials: true,
  },
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(OrderGateway.name);
  private subscriber: Redis | null = null;
  private subscriberAtivo = false;
  private readonly joinCountersLocal = new Map<string, { count: number; windowStart: number }>();
  private readonly userSocketsLocal = new Map<string, Set<string>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly membershipService: MembershipService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    this.setupDistributedSubscriber();
    this.cleanupTimer = setInterval(() => this.limparMemoria(), 60_000);
    this.cleanupTimer.unref?.();
  }

  private setupDistributedSubscriber(): void {
    const rawUrl = this.configService.get<string>('REDIS_URL');
    if (!rawUrl) {
      return;
    }
    const subscriber = new Redis(rawUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 5) {
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    });
    subscriber.on('error', (error) => {
      this.logger.warn(`Subscriber Redis: ${error.message}`);
    });
    subscriber.on('ready', () => {
      this.subscriberAtivo = true;
    });
    subscriber.on('end', () => {
      this.subscriberAtivo = false;
    });
    subscriber.on('message', (_channel, rawMessage) => {
      try {
        if (_channel === MEMBERSHIP_CHANNEL) {
          const payload = JSON.parse(rawMessage) as { userId?: string; eventId?: string };
          if (!payload?.userId || !payload.eventId) {
            return;
          }
          this.revogarAcessoLocal(payload.userId, payload.eventId);
          return;
        }
        if (_channel === PLANTA_CHANNEL) {
          const payload = JSON.parse(rawMessage) as { plantaId?: string; version?: number; tipo?: TipoAlteracaoPlanta; eventId?: string };
          if (!payload?.plantaId || !payload.eventId) {
            return;
          }
          if (this.server) {
            this.server.to(roomPlanta(payload.eventId)).emit(EVENTOS_SOCKET.plantaUpdated, {
              plantaId: payload.plantaId,
              version: payload.version,
              tipo: payload.tipo,
            });
          }
          return;
        }
        const payload = JSON.parse(rawMessage) as { orderId?: string; status?: string; eventId?: string };
        if (!payload?.orderId) {
          return;
        }
        const room = payload.eventId ? roomEvento(payload.eventId) : 'public';
        if (this.server) {
          this.server.to(room).emit(EVENTOS_SOCKET.orderUpdated, { orderId: payload.orderId, status: payload.status });
        }
      } catch {
        this.logger.warn('Mensagem malformada no canal de updates');
      }
    });
    subscriber.subscribe(CHANNEL, PLANTA_CHANNEL, MEMBERSHIP_CHANNEL).catch((error) => {
      this.logger.warn(`Não foi possível subscrever os canais de updates: ${error.message}`);
    });
    this.subscriber = subscriber;
  }

  /**
   * O NestJS não aguarda handleConnection() assíncrono antes de despachar
   * mensagens. Por isso, cada join autentica também a partir do handshake,
   * sem depender de client.data.user já ter sido preenchido pelo lifecycle hook.
   */
  private async autenticarSocket(client: Socket): Promise<{ id: string; role: string }> {
    const rawToken =
      client.handshake.auth?.token || client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('token em falta');
    }
    const payload = this.jwtService.verify<{ sub: string; role: string; exp?: number }>(rawToken, {
      algorithms: ['HS256'],
      issuer: 'senhasfestas-api',
      audience: 'senhasfestas-app',
    });
    const tokenExp = payload?.exp;
    if (
      !payload?.sub ||
      typeof tokenExp !== 'number' ||
      !Number.isInteger(tokenExp) ||
      tokenExp * 1000 <= Date.now()
    ) {
      throw new Error('token inválido ou sem expiração');
    }

    if (!client.data.authTimeout) {
      const authTimeout = setTimeout(
        () => client.disconnect(true),
        Math.max(0, tokenExp * 1000 - Date.now()),
      );
      authTimeout.unref?.();
      client.data.authTimeout = authTimeout;
    }

    const utilizador = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!utilizador) {
      throw new Error('utilizador inexistente ou inativo');
    }
    const autenticado = { id: utilizador.id, role: utilizador.role };
    client.data.user = autenticado;
    return autenticado;
  }

  async handleConnection(client: Socket) {
    try {
      const utilizador = await this.autenticarSocket(client);
      const ok = await this.registarSocket(utilizador.id, client.id);
      if (!ok) {
        this.logger.warn(`Limite de sockets por utilizador excedido: ${utilizador.id}`);
        client.disconnect(true);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const authTimeout = client.data?.authTimeout as NodeJS.Timeout | undefined;
    if (authTimeout) {
      clearTimeout(authTimeout);
      delete client.data.authTimeout;
    }
    const user = client.data?.user as { id?: string } | undefined;
    if (user?.id) {
      await this.removerSocket(user.id, client.id);
    }
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  private async contarJoin(userId: string): Promise<boolean> {
    const key = `ws:join:${userId}`;
    const contagem = await this.redisService.incrementWithTtl(key, Math.ceil(JOIN_WINDOW_MS / 1000));
    if (contagem !== null) {
      return contagem <= JOIN_LIMIT;
    }
    return this.permitirJoinLocal(userId);
  }

  private permitirJoinLocal(userId: string): boolean {
    const agora = Date.now();
    const atual = this.joinCountersLocal.get(userId);
    if (!atual || agora - atual.windowStart >= JOIN_WINDOW_MS) {
      this.joinCountersLocal.set(userId, { count: 1, windowStart: agora });
      return true;
    }
    if (atual.count >= JOIN_LIMIT) {
      return false;
    }
    atual.count += 1;
    return true;
  }

  private async registarSocket(userId: string, socketId: string): Promise<boolean> {
    const key = `ws:sockets:${userId}`;
    const total = await this.redisService.sadd(key, socketId);
    if (total !== null) {
      const cardinalidade = await this.redisService.scard(key);
      if (cardinalidade !== null && cardinalidade > MAX_SOCKETS_PER_USER) {
        await this.redisService.srem(key, socketId);
        return false;
      }
      await this.redisService.expire(key, 24 * 60 * 60);
      return true;
    }
    const socketSet = this.userSocketsLocal.get(userId) ?? new Set<string>();
    if (socketSet.size >= MAX_SOCKETS_PER_USER) {
      return false;
    }
    socketSet.add(socketId);
    this.userSocketsLocal.set(userId, socketSet);
    return true;
  }

  private async removerSocket(userId: string, socketId: string): Promise<void> {
    const key = `ws:sockets:${userId}`;
    const total = await this.redisService.srem(key, socketId);
    if (total === null) {
      const socketSet = this.userSocketsLocal.get(userId);
      if (socketSet) {
        socketSet.delete(socketId);
        if (socketSet.size === 0) {
          this.userSocketsLocal.delete(userId);
        }
      }
    }
  }

  private limparMemoria(): void {
    const agora = Date.now();
    for (const [userId, entry] of this.joinCountersLocal) {
      if (agora - entry.windowStart >= JOIN_WINDOW_MS) {
        this.joinCountersLocal.delete(userId);
      }
    }
    if (this.joinCountersLocal.size > 10_000) {
      this.joinCountersLocal.clear();
    }
    for (const [userId, sockets] of this.userSocketsLocal) {
      if (sockets.size === 0) {
        this.userSocketsLocal.delete(userId);
      }
    }
    if (this.userSocketsLocal.size > 5_000) {
      this.userSocketsLocal.clear();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
      this.subscriberAtivo = false;
    }
  }

  @SubscribeMessage(MENSAGENS_ENTRADA.evento)
  async handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: string,
  ) {
    let user: { id: string; role: string };
    try {
      user = await this.autenticarSocket(client);
    } catch {
      const message = 'Não autenticado';
      client.emit('error', { message });
      client.disconnect(true);
      return { ok: false, message };
    }
    if (!eventId || typeof eventId !== 'string') {
      client.emit('error', { message: 'eventId inválido' });
      return { ok: false, message: 'eventId inválido' };
    }
    if (!(await this.contarJoin(user.id))) {
      const message = 'Demasiados pedidos, aguarde um pouco';
      client.emit('error', { message });
      return { ok: false, message };
    }
    let role: string;
    try {
      role = await this.membershipService.roleEfetiva(user, eventId);
    } catch {
      const message = 'Não pertence a este evento';
      client.emit('error', { message });
      return { ok: false, message };
    }
    // A room contém todos os pedidos do evento. Clientes só podem consultar
    // os seus próprios pedidos por HTTP e não podem subscrever o fluxo global.
    if (!STAFF_ROLES.some((staffRole) => staffRole === role)) {
      const message = 'Sem permissão para actualizações de pedidos deste evento';
      client.emit('error', { message });
      return { ok: false, message };
    }
    await client.join(roomEvento(eventId));
    return { ok: true };
  }

  /**
   * Room própria para as alterações de planta, restrita a MANAGEMENT_ROLES: o
   * `joinEvent` aceita qualquer membro do evento, mas as rotas de planta são só
   * para superadmin/organizer. Sem esta separação, um role operacional (caixa,
   * cozinha) receberia metadados de planta que não pode obter por HTTP.
   */
  @SubscribeMessage(MENSAGENS_ENTRADA.planta)
  async handleJoinEventPlanta(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: string,
  ) {
    let user: { id: string; role: string };
    try {
      user = await this.autenticarSocket(client);
    } catch {
      const message = 'Não autenticado';
      client.emit('error', { message });
      client.disconnect(true);
      return { ok: false, message };
    }
    if (!eventId || typeof eventId !== 'string') {
      client.emit('error', { message: 'eventId inválido' });
      return { ok: false, message: 'eventId inválido' };
    }

    let role: string;
    try {
      role = await this.membershipService.roleEfetiva(user, eventId);
    } catch {
      const message = 'Não pertence a este evento';
      client.emit('error', { message });
      return { ok: false, message };
    }
    if (!MANAGEMENT_ROLES.includes(role)) {
      const message = 'Sem permissão para a planta deste evento';
      client.emit('error', { message });
      return { ok: false, message };
    }
    if (!(await this.contarJoin(user.id))) {
      const message = 'Demasiados pedidos, aguarde um pouco';
      client.emit('error', { message });
      return { ok: false, message };
    }
    await client.join(roomPlanta(eventId));
    return { ok: true };
  }

  private revogarAcessoLocal(userId: string, eventId: string): void {
    const sockets = this.server?.sockets?.sockets;
    if (!sockets) {
      return;
    }
    for (const socket of sockets.values()) {
      if (socket.data?.user?.id !== userId) {
        continue;
      }
      socket.leave(roomEvento(eventId));
      socket.leave(roomPlanta(eventId));
      socket.emit('membership:revoked', { eventId });
    }
  }

  /**
   * Remove imediatamente as rooms do evento quando a role muda ou a membership
   * é revogada. Redis propaga a invalidação às restantes instâncias.
   */
  revogarAcessoEvento(userId: string, eventId: string): void {
    if (!userId || !eventId) {
      return;
    }
    this.revogarAcessoLocal(userId, eventId);
    if (this.distribuirViaRedis) {
      void this.redisService
        .publish(MEMBERSHIP_CHANNEL, JSON.stringify({ userId, eventId }))
        .catch((error) => this.logger.warn(`Não foi possível propagar revogação WebSocket: ${error.message}`));
    } else if (this.subscriber) {
      this.logger.warn('Redis indisponível: revogação WebSocket limitada a esta instância');
    }
  }

  /**
   * Só distribui via Redis quando o subscriber está operacional. Com Redis em
   * baixo (ou a arrancar) cai na emissão local direta, em vez de perder o evento
   * num publish que falha.
   */
  private get distribuirViaRedis(): boolean {
    return this.subscriber !== null && this.subscriberAtivo;
  }

  emitOrderUpdate(orderId: string, status: string, eventId?: string) {
    const room = eventId ? roomEvento(eventId) : 'public';
    const payload = JSON.stringify({ orderId, status, eventId, at: new Date().toISOString() });

    // Com subscriber ativo, a re-emissão local para os sockets desta instância é feita
    // pelo subscriber (evita duplicação de eventos com múltiplas réplicas).
    // Sem Redis, cai no modo degradado de emissão local direta.
    if (this.distribuirViaRedis) {
      void this.redisService.publish(CHANNEL, payload);
    } else if (this.server) {
      this.server.to(room).emit(EVENTOS_SOCKET.orderUpdated, { orderId, status });
    }
    this.redisService.set(`order:status:${orderId}`, status, ORDER_STATUS_CACHE_TTL);
  }

  /**
   * Avisa os clientes do evento que uma planta foi criada, alterada, renomeada
   * ou apagada. Não transporta o documento: o cliente volta a pedi-lo por HTTP.
   * Com subscriber ativo a re-emissão local é feita pelo subscriber (multi-réplica);
   * sem Redis cai na emissão local direta.
   */
  emitPlantaUpdate(eventId: string, plantaId: string, version: number, tipo: TipoAlteracaoPlanta) {
    const payload = JSON.stringify({ eventId, plantaId, version, tipo, at: new Date().toISOString() });
    if (this.distribuirViaRedis) {
      void this.redisService.publish(PLANTA_CHANNEL, payload);
    } else if (this.server) {
      this.server.to(roomPlanta(eventId)).emit(EVENTOS_SOCKET.plantaUpdated, { plantaId, version, tipo });
    }
  }
}
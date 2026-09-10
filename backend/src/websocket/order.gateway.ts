import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { EventUserEntity } from '../entities';
import { RedisService } from '../common/redis/redis.service';

const ORDER_STATUS_CACHE_TTL = 60 * 60 * 24;
const CHANNEL = 'order:updates';

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

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
  ) {
    this.setupDistributedSubscriber();
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
    subscriber.on('message', (_channel, rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage) as { orderId?: string; status?: string; eventId?: string };
        if (!payload?.orderId) {
          return;
        }
        const room = payload.eventId ? `event:${payload.eventId}` : 'public';
        this.server.to(room).emit('orderUpdated', { orderId: payload.orderId, status: payload.status });
      } catch {
        this.logger.warn('Mensagem malformada no canal order:updates');
      }
    });
    subscriber.subscribe(CHANNEL).catch((error) => {
      this.logger.warn(`Não foi possível subscrever ${CHANNEL}: ${error.message}`);
    });
    this.subscriber = subscriber;
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!rawToken || typeof rawToken !== 'string') {
        throw new Error('token em falta');
      }
      const payload = this.jwtService.verify<{ sub: string; role: string }>(rawToken, {
        algorithms: ['HS256'],
        issuer: 'senhasfestas-api',
        audience: 'senhasfestas-app',
      });
      if (!payload?.sub) {
        throw new Error('token inválido');
      }
      client.data.user = { id: payload.sub, role: payload.role };
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
    }
  }

  @SubscribeMessage('joinEvent')
  async handleJoinEvent(@ConnectedSocket() client: Socket, @MessageBody() eventId: string) {
    const user = client.data?.user;
    if (!user) {
      client.emit('error', { message: 'Não autenticado' });
      return;
    }
    if (!eventId || typeof eventId !== 'string') {
      client.emit('error', { message: 'eventId inválido' });
      return;
    }
    if (user.role !== 'superadmin') {
      const membership = await this.eventUserRepository.findOne({
        where: { event: { id: eventId }, user: { id: user.id } },
      });
      if (!membership) {
        client.emit('error', { message: 'Não pertence a este evento' });
        return;
      }
    }
    client.join(`event:${eventId}`);
  }

  emitOrderUpdate(orderId: string, status: string, eventId?: string) {
    const room = eventId ? `event:${eventId}` : 'public';
    const payload = JSON.stringify({ orderId, status, eventId, at: new Date().toISOString() });

    // Com subscriber ativo, a re-emissão local para os sockets desta instância é feita
    // pelo subscriber (evita duplicação de eventos com múltiplas réplicas).
    // Sem Redis, cai no modo degradado de emissão local direta.
    if (this.subscriber) {
      void this.redisService.publish(CHANNEL, payload);
    } else {
      this.server.to(room).emit('orderUpdated', { orderId, status });
    }
    this.redisService.set(`order:status:${orderId}`, status, ORDER_STATUS_CACHE_TTL);
  }
}
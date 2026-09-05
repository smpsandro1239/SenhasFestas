import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventUserEntity } from '../entities';
import { RedisService } from '../common/redis/redis.service';

const ORDER_STATUS_CACHE_TTL = 60 * 60 * 24;

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
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
  ) {
    void this.configService;
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
    console.log(`Cliente desconectado: ${client.id}`);
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
    this.server.to(room).emit('orderUpdated', { orderId, status });

    // Camada de pub/sub para escalabilidade (várias instâncias do backend partilham o estado via Redis)
    this.redisService.set(`order:status:${orderId}`, status, ORDER_STATUS_CACHE_TTL);
    this.redisService.publish('order:updates', JSON.stringify({ orderId, status, at: new Date().toISOString() }));
  }
}
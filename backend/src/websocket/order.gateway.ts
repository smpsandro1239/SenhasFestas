import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('joinKitchen')
  handleJoinKitchen(@ConnectedSocket() client: Socket) {
    client.join('kitchen');
    console.log(`Cliente ${client.id} entrou na sala kitchen`);
  }

  @SubscribeMessage('joinPublic')
  handleJoinPublic(@ConnectedSocket() client: Socket) {
    client.join('public');
    console.log(`Cliente ${client.id} entrou na sala public`);
  }

  @SubscribeMessage('orderCreated')
  handleOrderCreated(@MessageBody() data: any) {
    console.log('Novo pedido criado:', data);
    this.server.to('kitchen').emit('newOrder', data);
    this.server.to('public').emit('newOrder', data);
  }

  @SubscribeMessage('orderStatusChanged')
  handleOrderStatusChanged(@MessageBody() data: { orderId: string; status: string }) {
    console.log('Status alterado:', data);
    this.server.to('kitchen').emit('orderUpdated', data);
    this.server.to('public').emit('orderUpdated', data);
  }

  emitOrderUpdate(orderId: string, status: string) {
    this.server.to('kitchen').emit('orderUpdated', { orderId, status });
    this.server.to('public').emit('orderUpdated', { orderId, status });
  }
}

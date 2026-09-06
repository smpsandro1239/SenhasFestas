import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, EventUserEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';

const ECRAN_PUBLICO_FIELDS = [
  'pedido.id',
  'pedido.status',
  'pedido.tableNumber',
  'pedido.station',
  'pedido.total',
  'pedido.createdAt',
  'pedido.updatedAt',
] as const;

@Injectable()
export class PublicScreenService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    private readonly orderGateway: OrderGateway,
  ) {}

  async obterPedidosProntos(eventId: string): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.eventId = :eventId', { eventId })
      .andWhere('pedido.status = :status', { status: 'ready' })
      .orderBy('pedido.updatedAt', 'DESC')
      .limit(20)
      .getMany();
  }

  async obterPedidosEmPreparacao(eventId: string): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.eventId = :eventId', { eventId })
      .andWhere('pedido.status = :status', { status: 'preparing' })
      .orderBy('pedido.createdAt', 'ASC')
      .getMany();
  }

  async obterPedidosRecebidos(eventId: string): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.eventId = :eventId', { eventId })
      .andWhere('pedido.status = :status', { status: 'received' })
      .orderBy('pedido.createdAt', 'ASC')
      .limit(50)
      .getMany();
  }

  async obterContagemPedidos(eventId: string): Promise<{ prontos: number; emPreparacao: number; recebidos: number }> {
    const [prontos, emPreparacao, recebidos] = await Promise.all([
      this.orderRepository.count({ where: { event: { id: eventId }, status: 'ready' } }),
      this.orderRepository.count({ where: { event: { id: eventId }, status: 'preparing' } }),
      this.orderRepository.count({ where: { event: { id: eventId }, status: 'received' } }),
    ]);
    return { prontos, emPreparacao, recebidos };
  }

  async marcarEntregue(id: string, utilizador: any): Promise<any> {
    const pedido = await this.orderRepository.findOne({
      where: { id },
      relations: { event: true },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (utilizador?.role !== 'superadmin') {
      const eventId = pedido.event?.id;
      if (!eventId) {
        throw new ForbiddenException('Pedido sem evento associado');
      }
      const membro = await this.eventUserRepository.findOne({
        where: { event: { id: eventId }, user: { id: utilizador?.id } },
      });
      if (!membro) {
        throw new ForbiddenException('Não pertence a este evento');
      }
    }

    if (pedido.status !== 'ready') {
      throw new BadRequestException('Pedido não está pronto para entrega');
    }
    pedido.status = 'delivered';
    const pedidoAtualizado = await this.orderRepository.save(pedido);

    // Emitir evento WebSocket para o ecrã público
    this.orderGateway.emitOrderUpdate(pedidoAtualizado.id, pedidoAtualizado.status, pedido.event?.id);

    return pedidoAtualizado;
  }
}
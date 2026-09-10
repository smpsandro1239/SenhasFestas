import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrderEntity, EventUserEntity, EventEntity } from '../../entities';
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
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly orderGateway: OrderGateway,
  ) {}

  async obterEventoPublico(eventId: string): Promise<Partial<EventEntity>> {
    const evento = await this.eventRepository.findOne({
      where: { id: eventId },
      select: { id: true, name: true, location: true, startDate: true, endDate: true },
    });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado');
    }
    return evento;
  }

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
    return this.dataSource.transaction(async (manager) => {
      const pedido = await manager.findOne(OrderEntity, {
        where: { id },
        relations: { event: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pedido) {
        throw new NotFoundException('Pedido não encontrado');
      }

      if (utilizador?.role !== 'superadmin') {
        const eventId = pedido.event?.id;
        if (!eventId) {
          throw new ForbiddenException('Pedido sem evento associado');
        }
        const membro = await manager.findOne(EventUserEntity, {
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
      const pedidoAtualizado = await manager.save(OrderEntity, pedido);

      // Emitir evento WebSocket para o ecrã público
      this.orderGateway.emitOrderUpdate(pedidoAtualizado.id, pedidoAtualizado.status, pedido.event?.id);

      return pedidoAtualizado;
    });
  }
}
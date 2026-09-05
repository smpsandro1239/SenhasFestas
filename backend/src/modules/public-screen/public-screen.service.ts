import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities';
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
    private readonly orderGateway: OrderGateway,
  ) {}

  async obterPedidosProntos(): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.status = :status', { status: 'ready' })
      .orderBy('pedido.updatedAt', 'DESC')
      .limit(20)
      .getMany();
  }

  async obterPedidosEmPreparacao(): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.status = :status', { status: 'preparing' })
      .orderBy('pedido.createdAt', 'ASC')
      .getMany();
  }

  async obterPedidosRecebidos(): Promise<Partial<OrderEntity>[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoin('itens.product', 'produto')
      .select([...ECRAN_PUBLICO_FIELDS, 'itens.id', 'itens.quantity', 'itens.notes', 'produto.name'])
      .where('pedido.status = :status', { status: 'received' })
      .orderBy('pedido.createdAt', 'ASC')
      .limit(50)
      .getMany();
  }

  async obterContagemPedidos(): Promise<{ prontos: number; emPreparacao: number; recebidos: number }> {
    const [prontos, emPreparacao, recebidos] = await Promise.all([
      this.orderRepository.count({ where: { status: 'ready' } }),
      this.orderRepository.count({ where: { status: 'preparing' } }),
      this.orderRepository.count({ where: { status: 'received' } }),
    ]);
    return { prontos, emPreparacao, recebidos };
  }

  async marcarEntregue(id: string): Promise<any> {
    const pedido = await this.orderRepository.findOne({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (pedido.status !== 'ready') {
      throw new BadRequestException('Pedido não está pronto para entrega');
    }
    pedido.status = 'delivered';
    const pedidoAtualizado = await this.orderRepository.save(pedido);

    // Emitir evento WebSocket para o ecrã público
    this.orderGateway.emitOrderUpdate(pedidoAtualizado.id, pedidoAtualizado.status);

    return pedidoAtualizado;
  }
}
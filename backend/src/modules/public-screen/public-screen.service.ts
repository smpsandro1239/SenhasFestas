import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities';

@Injectable()
export class PublicScreenService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async obterPedidosProntos(): Promise<any[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .where('pedido.status = :status', { status: 'ready' })
      .orderBy('pedido.updatedAt', 'DESC')
      .limit(20)
      .getMany();
  }

  async obterPedidosEmPreparacao(): Promise<any[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
      .where('pedido.status = :status', { status: 'preparing' })
      .orderBy('pedido.createdAt', 'ASC')
      .getMany();
  }

  async obterPedidosRecebidos(): Promise<any[]> {
    return this.orderRepository
      .createQueryBuilder('pedido')
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
      throw new Error('Pedido não está pronto para entrega');
    }
    pedido.status = 'delivered';
    return this.orderRepository.save(pedido);
  }
}
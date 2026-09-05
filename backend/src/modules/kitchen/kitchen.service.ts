import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';

export interface FiltrosKDS {
  status?: string;
  estacao?: string;
  categoria?: string;
  station?: string;
}

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly orderGateway: OrderGateway,
  ) {}

  async obterPedidos(filtros: FiltrosKDS): Promise<any[]> {
    const query = this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoinAndSelect('itens.product', 'produto')
      .orderBy('pedido.createdAt', 'ASC');

    if (filtros.status) {
      query.andWhere('pedido.status = :status', { status: filtros.status });
    } else {
      query.andWhere('pedido.status IN (:...status)', {
        status: ['received', 'preparing'],
      });
    }

    if (filtros.estacao || filtros.station) {
      query.andWhere('pedido.station = :estacao', { estacao: filtros.estacao || filtros.station });
    }

    return query.getMany();
  }

  async atualizarEstado(id: string, novoEstado: string, _utilizadorId: string): Promise<any> {
    const pedido = await this.orderRepository.findOne({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const transicoesValidas: Record<string, string[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered'],
    };

    if (!transicoesValidas[pedido.status]?.includes(novoEstado)) {
      throw new BadRequestException(`Transição inválida: ${pedido.status} -> ${novoEstado}`);
    }

    pedido.status = novoEstado;
    const pedidoAtualizado = await this.orderRepository.save(pedido);
    
    // Emitir evento WebSocket para a cozinha
    this.orderGateway.emitOrderUpdate(pedidoAtualizado.id, pedidoAtualizado.status);
    
    return pedidoAtualizado;
  }

  async obterEstatisticas(): Promise<any> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      this.orderRepository.count({ where: { status: 'received' } }),
      this.orderRepository.count({ where: { status: 'preparing' } }),
      this.orderRepository.count({ where: { status: 'ready' } }),
      this.orderRepository.count({ where: { status: 'delivered', createdAt: hoje } }),
    ]);

    return {
      recebidos,
      emPreparacao,
      prontos,
      entregues,
      total: recebidos + emPreparacao + prontos,
    };
  }
}

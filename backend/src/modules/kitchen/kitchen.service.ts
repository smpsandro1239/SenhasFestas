import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities';
import { MembershipService } from '../../common/membership.service';
import { OrderGateway } from '../../websocket/order.gateway';
import { KitchenQueryDto } from './dto';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly membershipService: MembershipService,
    private readonly orderGateway: OrderGateway,
  ) {}

  private async obterEventosDoUtilizador(utilizador: any): Promise<string[] | null> {
    return this.membershipService.eventIdsFor(utilizador);
  }

  async obterPedidos(filtros: KitchenQueryDto, utilizador: any): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const eventIds = await this.obterEventosDoUtilizador(utilizador);
    const page = filtros?.page ?? 1;
    const limit = filtros?.limit ?? 20;

    const query = this.orderRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'itens')
      .leftJoinAndSelect('itens.product', 'produto')
      .orderBy('pedido.createdAt', 'ASC');

    if (filtros?.status) {
      query.andWhere('pedido.status = :status', { status: filtros.status });
    } else {
      query.andWhere('pedido.status IN (:...status)', {
        status: ['received', 'preparing'],
      });
    }

    if (filtros?.station) {
      query.andWhere('pedido.station = :station', { station: filtros.station });
    }

    const scope = this.membershipService.eventColumnFor(eventIds);
    if (scope) {
      query.andWhere('pedido.' + scope.column, scope.params);
    }

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async atualizarEstado(id: string, novoEstado: string, utilizador: any): Promise<any> {
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
      await this.membershipService.assertMember(utilizador, eventId);
    }

    const transicoesValidas: Record<string, string[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered'],
    };

    if (!transicoesValidas[pedido.status]?.includes(novoEstado)) {
      throw new BadRequestException(`Transição inválida: ${pedido.status} -> ${novoEstado}`);
    }

    const pedidoAtualizado = await this.orderRepository.manager.transaction(async (manager) => {
      const atual = await manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!atual || atual.status !== pedido.status) {
        throw new BadRequestException('Pedido mudou de estado, tente novamente');
      }
      atual.status = novoEstado;
      return manager.save(OrderEntity, atual);
    });

    // Emitir evento WebSocket para a cozinha
    this.orderGateway.emitOrderUpdate(pedidoAtualizado.id, pedidoAtualizado.status, pedido.event?.id);

    return pedidoAtualizado;
  }

  async obterEstatisticas(utilizador: any): Promise<any> {
    const eventIds = await this.obterEventosDoUtilizador(utilizador);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contagem = (status: string, extra?: { sql: string; params: Record<string, unknown> }) => {
      const query = this.orderRepository
        .createQueryBuilder('pedido')
        .where('pedido.status = :status', { status });
      const scope = this.membershipService.eventColumnFor(eventIds);
      if (scope) {
        query.andWhere('pedido.' + scope.column, scope.params);
      }
      if (extra) {
        query.andWhere(extra.sql, extra.params);
      }
      return query.getCount();
    };

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      contagem('received'),
      contagem('preparing'),
      contagem('ready'),
      contagem('delivered', { sql: 'pedido.createdAt >= :hoje', params: { hoje } }),
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
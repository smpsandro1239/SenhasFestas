import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { OrderEntity, EventUserEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';
import { KitchenQueryDto } from './dto';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    private readonly orderGateway: OrderGateway,
  ) {}

  private async obterEventosDoUtilizador(utilizador: any): Promise<string[]> {
    if (!utilizador || utilizador.role === 'superadmin') {
      return [];
    }
    const membros = await this.eventUserRepository.find({
      where: { user: { id: utilizador.id } as any },
      relations: { event: true },
    });
    return membros.map((m) => m.event?.id).filter((id): id is string => Boolean(id));
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

    if (eventIds.length > 0) {
      query.andWhere('pedido.eventId IN (:...eventIds)', { eventIds });
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
      const membro = await this.eventUserRepository.findOne({
        where: { event: { id: eventId }, user: { id: utilizador?.id } },
      });
      if (!membro) {
        throw new ForbiddenException('Não pertence a este evento');
      }
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

    const condicoes = (where: Record<string, unknown>, extra?: Record<string, unknown>) => {
      const base: Record<string, unknown> = { ...where };
      if (eventIds.length > 0) {
        base.eventId = In(eventIds);
      }
      return { ...base, ...extra };
    };

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      this.orderRepository.count(condicoes({ status: 'received' })),
      this.orderRepository.count(condicoes({ status: 'preparing' })),
      this.orderRepository.count(condicoes({ status: 'ready' })),
      this.orderRepository.count(condicoes({ status: 'delivered' }, { createdAt: MoreThanOrEqual(hoje) })),
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
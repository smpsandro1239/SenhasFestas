import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, OrderItemEntity, BalanceMovementEntity } from '../../entities';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly balanceRepository: Repository<BalanceMovementEntity>,
  ) {}

  async obterOrdens(filtros: { status?: string; estacao?: string; station?: string }) {
    const query = this.orderRepository
      .createQueryBuilder('orden')
      .leftJoinAndSelect('orden.items', 'itens')
      .leftJoinAndSelect('itens.product', 'product')
      .orderBy('orden.createdAt', 'ASC');

    if (filtros.status) {
      query.andWhere('orden.status = :status', { status: filtros.status });
    } else {
      query.andWhere('orden.status IN (:...status)', {
        status: ['received', 'preparing'],
      });
    }

    const estacao = filtros.estacao || filtros.station;
    if (estacao) {
      query.andWhere('orden.station = :estacao', { estacao });
    }

    return query.getMany();
  }

  async obterSaldo(filtros: { id?: string }) {
    if (!filtros?.id) {
      return [];
    }
    const query = this.balanceRepository
      .createQueryBuilder('movimentacao')
      .where('movimentacao.balanceId = :id', { id: filtros.id })
      .orderBy('movimentacao.createdAt', 'ASC');

    return query.getMany();
  }

  async topProducts(_filtros?: any) {
    return this.orderItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.price', 'price')
      .addSelect('SUM(item.quantity)', 'totalVendido')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.price')
      .orderBy('"totalVendido"', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async obterEstatisticas() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      this.orderRepository.count({ where: { status: 'received' } }),
      this.orderRepository.count({ where: { status: 'preparing' } }),
      this.orderRepository.count({ where: { status: 'ready' } }),
      this.orderRepository
        .createQueryBuilder('orden')
        .where('orden.status = :status', { status: 'delivered' })
        .andWhere('orden.updatedAt >= :today', { today })
        .getCount(),
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
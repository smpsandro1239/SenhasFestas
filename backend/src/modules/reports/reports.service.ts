import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities';
import { BalanceMovementEntity } from '../../entities';
import { ProductEntity } from '../../entities';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(BalanceMovementEntity)
    private readonly balanceRepository: Repository<BalanceMovementEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async obterOrdens(filtros: any) {
    const query = this.orderRepository
      .createQueryBuilder('orden')
      .leftJoinAndSelect('orden.items', 'itens')
      .leftJoinAndSelect('itens.produto', 'produto')
      .orderBy('orden.createdAt', 'ASC');

    if (filtros.status) {
      query.andWhere('orden.status = :status', { status: filtros.status });
    } else {
      query.andWhere('orden.status IN (:...status)', {
        status: ['received', 'preparing'],
      });
    }

    if (filtros.estacao) {
      query.andWhere('orden.station = :estacao', { estacao: filtros.estacao });
    }

    return query.getMany();
  }

  async obterSaldo(filtros: any) {
    const query = this.balanceRepository
      .createQueryBuilder('movimentacao')
      .where('movimentacao.balanceId = :id', { id: filtros.id })
      .orderBy('movimentacao.createdAt', 'ASC');

    return query.getMany();
  }

  async topProducts(_filtros: any) {
    const query = this.productRepository
      .createQueryBuilder('produto')
      .where('produto.isActive = :active', { active: true })
      .orderBy('produto.quantity', 'DESC')
      .limit(10);

    return query.getMany();
  }

  async obterEstatisticas() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [recebidos, emPreparacao, prontos, entregues] = await Promise.all([
      this.orderRepository.count({ where: { status: 'received' } }),
      this.orderRepository.count({ where: { status: 'preparing' } }),
      this.orderRepository.count({ where: { status: 'ready' } }),
      this.orderRepository.count({ where: { status: 'delivered', createdAt: today } }),
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

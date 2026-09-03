import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashClosureEntity } from '../../entities';
import { CreateCashClosureDto, CloseCashClosureDto } from './dto';

@Injectable()
export class CashClosureService {
  constructor(
    @InjectRepository(CashClosureEntity)
    private readonly cashClosureRepository: Repository<CashClosureEntity>,
  ) {}

  async abrirCaixa(
    operadorId: string,
    dto: CreateCashClosureDto,
  ): Promise<CashClosureEntity> {
    const novoFecho = this.cashClosureRepository.create({
      eventId: dto.eventId,
      openedById: operadorId,
      openingBalance: dto.openingBalance || 0,
      openedAt: new Date(),
      notes: dto.notes,
      status: 'open',
    });
    return this.cashClosureRepository.save(novoFecho);
  }

  async fecharCaixa(
    id: string,
    operadorId: string,
    dto: CloseCashClosureDto,
  ): Promise<CashClosureEntity> {
    const fecho = await this.cashClosureRepository.findOne({ where: { id } });
    if (!fecho) {
      throw new NotFoundException('Caixa não encontrado');
    }
    if (fecho.openedById !== operadorId) {
      throw new ForbiddenException('Apenas o operador que abriu pode fechar');
    }
    if (fecho.status === 'closed') {
      throw new Error('Caixa já está fechado');
    }

    fecho.closedAt = new Date();
    fecho.closingBalance = dto.totalActual;
    fecho.status = 'closed';
    if (dto.notes) fecho.notes = dto.notes;

    return this.cashClosureRepository.save(fecho);
  }

  async listarPorEvento(eventoId: string): Promise<CashClosureEntity[]> {
    return this.cashClosureRepository.find({
      where: { eventId: eventoId },
      order: { openedAt: 'DESC' },
    });
  }

  async obterPorId(id: string): Promise<CashClosureEntity> {
    const fecho = await this.cashClosureRepository.findOne({ where: { id } });
    if (!fecho) {
      throw new NotFoundException('Caixa não encontrado');
    }
    return fecho;
  }

  async obterCaixaAberta(eventoId: string): Promise<CashClosureEntity> {
    return this.cashClosureRepository.findOne({
      where: { eventId: eventoId, status: 'open' },
    });
  }
}
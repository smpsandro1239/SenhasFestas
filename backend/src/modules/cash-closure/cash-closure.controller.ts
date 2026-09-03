import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CashClosureService } from './cash-closure.service';
import { CreateCashClosureDto } from './dto';

@Controller('cash-closure')
@UseGuards(AuthGuard('jwt'))
export class CashClosureController {
  constructor(private readonly cashClosureService: CashClosureService) {}

  @Post('abrir')
  async abrir(@Request() req: any, @Body() dto: CreateCashClosureDto) {
    return this.cashClosureService.abrirCaixa(req.user.id, dto);
  }

  @Post(':id/fechar')
  async fechar(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: { totalActual: number },
  ) {
    return this.cashClosureService.fecharCaixa(id, req.user.id, dto);
  }

  @Get('event/:eventoId')
  async listar(@Param('eventoId') eventoId: string) {
    return this.cashClosureService.listarPorEvento(eventoId);
  }

  @Get(':id')
  async obter(@Param('id') id: string) {
    return this.cashClosureService.obterPorId(id);
  }

  @Get('event/:eventoId/aberta')
  async obterAberta(@Param('eventoId') eventoId: string) {
    return this.cashClosureService.obterCaixaAberta(eventoId);
  }
}
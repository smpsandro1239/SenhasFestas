import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CashClosureService } from './cash-closure.service';
import { CreateCashClosureDto, CloseCashClosureDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'treasurer'];

@Controller('cash-closure')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CashClosureController {
  constructor(private readonly cashClosureService: CashClosureService) {}

  @Post('abrir')
  @Roles(...STAFF_ROLES)
  async abrir(@Request() req: any, @Body() dto: CreateCashClosureDto) {
    return this.cashClosureService.abrirCaixa(req.user.id, dto);
  }

  @Post(':id/fechar')
  @Roles(...STAFF_ROLES)
  async fechar(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: CloseCashClosureDto,
  ) {
    return this.cashClosureService.fecharCaixa(id, req.user.id, dto);
  }

  @Get('event/:eventoId')
  @Roles(...STAFF_ROLES)
  async listar(@Param('eventoId') eventoId: string) {
    return this.cashClosureService.listarPorEvento(eventoId);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  async obter(@Param('id') id: string) {
    return this.cashClosureService.obterPorId(id);
  }

  @Get('event/:eventoId/aberta')
  @Roles(...STAFF_ROLES)
  async obterAberta(@Param('eventoId') eventoId: string) {
    return this.cashClosureService.obterCaixaAberta(eventoId);
  }
}
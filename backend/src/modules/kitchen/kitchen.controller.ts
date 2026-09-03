import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KitchenService } from './kitchen.service';

@Controller('kitchen')
@UseGuards(AuthGuard('jwt'))
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('pedidos')
  async obterPedidos(@Query() filtros: { status?: string; estacao?: string }) {
    return this.kitchenService.obterPedidos(filtros);
  }

  @Patch('pedidos/:id Estado')
  async atualizarEstado(
    @Param('id') id: string,
    @Query('estado') estado: string,
    @Request() req: any,
  ) {
    return this.kitchenService.atualizarEstado(id, estado, req.user.id);
  }

  @Get('estatisticas')
  async obterEstatisticas() {
    return this.kitchenService.obterEstatisticas();
  }
}
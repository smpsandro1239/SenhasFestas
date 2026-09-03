import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KitchenService } from './kitchen.service';

@Controller('kitchen')
@UseGuards(AuthGuard('jwt'))
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  async getOrders(@Query() filters: { status?: string; station?: string }) {
    return this.kitchenService.obterPedidos(filters);
  }

  @Patch('orders/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    return this.kitchenService.atualizarEstado(id, status, req.user.id);
  }

  @Get('stats')
  async getStats() {
    return this.kitchenService.obterEstatisticas();
  }
}
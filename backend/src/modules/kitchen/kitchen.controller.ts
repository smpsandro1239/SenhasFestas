import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KitchenService } from './kitchen.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('kitchen')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  async getOrders(@Query() filters: { status?: string; station?: string }) {
    return this.kitchenService.obterPedidos(filters);
  }

  @Get('pedidos')
  async getPedidos(@Query() filters: { status?: string; station?: string }) {
    return this.kitchenService.obterPedidos(filters);
  }

  @Patch('orders/:id/status')
  @Roles('superadmin', 'organizer', 'kitchen', 'bar')
  async updateStatus(
    @Param('id') id: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    return this.kitchenService.atualizarEstado(id, status, req.user.id);
  }

  @Get('stats')
  @Roles('superadmin', 'organizer', 'kitchen', 'bar')
  async getStats() {
    return this.kitchenService.obterEstatisticas();
  }
}
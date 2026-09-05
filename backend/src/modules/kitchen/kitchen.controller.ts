import { Controller, Get, Patch, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KitchenService } from './kitchen.service';
import { KitchenQueryDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const KITCHEN_ROLES = ['superadmin', 'organizer', 'kitchen', 'bar'];

@Controller('kitchen')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  @Roles(...KITCHEN_ROLES)
  async getOrders(@Query() filters: KitchenQueryDto, @Request() req: any) {
    return this.kitchenService.obterPedidos(filters, req.user);
  }

  @Get('pedidos')
  @Roles(...KITCHEN_ROLES)
  async getPedidos(@Query() filters: KitchenQueryDto, @Request() req: any) {
    return this.kitchenService.obterPedidos(filters, req.user);
  }

  @Patch('orders/:id/status')
  @Roles(...KITCHEN_ROLES)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    return this.kitchenService.atualizarEstado(id, status, req.user);
  }

  @Get('stats')
  @Roles(...KITCHEN_ROLES)
  async getStats(@Request() req: any) {
    return this.kitchenService.obterEstatisticas(req.user);
  }
}
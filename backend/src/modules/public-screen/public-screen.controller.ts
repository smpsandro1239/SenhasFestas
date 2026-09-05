import { Controller, Get, Param, Patch, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PublicScreenService } from './public-screen.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('public')
export class PublicScreenController {
  constructor(private readonly publicScreenService: PublicScreenService) {}

  @Get('pedidos-prontos')
  async pedidosProntos() {
    return this.publicScreenService.obterPedidosProntos();
  }

  @Get('pedidos-em-preparacao')
  async pedidosEmPreparacao() {
    return this.publicScreenService.obterPedidosEmPreparacao();
  }

  @Get('pedidos-recebidos')
  async pedidosRecebidos() {
    return this.publicScreenService.obterPedidosRecebidos();
  }

  @Get('contagem')
  async contagem() {
    return this.publicScreenService.obterContagemPedidos();
  }

  @Patch('pedidos/:id/entregue')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('superadmin', 'organizer', 'cashier', 'bar', 'kitchen')
  async entregar(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicScreenService.marcarEntregue(id);
  }
}
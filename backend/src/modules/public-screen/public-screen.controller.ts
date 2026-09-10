import { Controller, Get, Param, Patch, UseGuards, Query, Request, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PublicScreenService } from './public-screen.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('public')
export class PublicScreenController {
  constructor(private readonly publicScreenService: PublicScreenService) {}

  @Get('evento')
  async evento(@Query('eventId', ParseUUIDPipe) eventId: string) {
    return this.publicScreenService.obterEventoPublico(eventId);
  }

  @Get('pedidos-prontos')
  async pedidosProntos(@Query('eventId', ParseUUIDPipe) eventId: string) {
    return this.publicScreenService.obterPedidosProntos(eventId);
  }

  @Get('pedidos-em-preparacao')
  async pedidosEmPreparacao(@Query('eventId', ParseUUIDPipe) eventId: string) {
    return this.publicScreenService.obterPedidosEmPreparacao(eventId);
  }

  @Get('pedidos-recebidos')
  async pedidosRecebidos(@Query('eventId', ParseUUIDPipe) eventId: string) {
    return this.publicScreenService.obterPedidosRecebidos(eventId);
  }

  @Get('contagem')
  async contagem(@Query('eventId', ParseUUIDPipe) eventId: string) {
    return this.publicScreenService.obterContagemPedidos(eventId);
  }

  @Patch('pedidos/:id/entregue')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('superadmin', 'organizer', 'cashier', 'bar', 'kitchen')
  async entregar(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.publicScreenService.marcarEntregue(id, req.user);
  }
}
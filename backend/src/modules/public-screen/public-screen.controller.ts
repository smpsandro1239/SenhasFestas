import { Controller, Get, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { PublicScreenService } from './public-screen.service';

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
  async entregar(@Param('id') id: string, @Request() req: any) {
    return this.publicScreenService.marcarEntregue(id);
  }
}
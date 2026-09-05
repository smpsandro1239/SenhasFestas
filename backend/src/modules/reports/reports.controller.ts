import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('ordens')
  async ordens(@Query() filters: any) {
    return this.reportsService.obterOrdens(filters);
  }

  @Get('saldo')
  async saldo(@Query() filters: any) {
    return this.reportsService.obterSaldo(filters);
  }

  @Get('top-products')
  async topProducts(@Query() filters: any) {
    return this.reportsService.topProducts(filters);
  }

  @Get('estatisticas')
  async estatisticas() {
    return this.reportsService.obterEstatisticas();
  }
}

import { Controller, Get, Query, UseGuards, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto, TotalQueryDto, BalancesQueryDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FINANCE_ROLES } from '../../common/roles';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('export.csv')
  @Roles(...FINANCE_ROLES)
  async exportCsv(@Query() filters: OrdensQueryDto, @Request() req: any, @Res() res: Response) {
    const csv = await this.reportsService.exportOrdensCsv(filters, req.user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ordens.csv"');
    res.send(csv);
  }

  @Get('ordens')
  @Roles(...FINANCE_ROLES)
  async ordens(@Query() filters: OrdensQueryDto, @Request() req: any) {
    return this.reportsService.obterOrdens(filters, req.user);
  }

  @Get('saldo')
  @Roles(...FINANCE_ROLES)
  async saldo(@Query() filters: SaldoQueryDto, @Request() req: any) {
    return this.reportsService.obterSaldo(filters, req.user);
  }

  @Get('total')
  @Roles(...FINANCE_ROLES)
  async totalVendas(@Query() filters: TotalQueryDto, @Request() req: any) {
    return this.reportsService.obterTotalVendas(filters, req.user);
  }

  @Get('top-products')
  @Roles(...FINANCE_ROLES)
  async topProducts(@Query() filters: TopProductsQueryDto, @Request() req: any) {
    return this.reportsService.topProducts(filters, req.user);
  }

  @Get('series')
  @Roles(...FINANCE_ROLES)
  async seriesVendas(@Query() filters: TotalQueryDto, @Request() req: any) {
    return this.reportsService.obterSeriesVendas(filters, req.user);
  }

  @Get('metodos')
  @Roles(...FINANCE_ROLES)
  async metodosPagamento(@Query() filters: TotalQueryDto, @Request() req: any) {
    return this.reportsService.obterMetodosPagamento(filters, req.user);
  }

  @Get('movimentos')
  @Roles(...FINANCE_ROLES)
  async resumoMovimentos(@Query() filters: TotalQueryDto, @Request() req: any) {
    return this.reportsService.obterResumoMovimentos(filters, req.user);
  }

  @Get('estatisticas')
  @Roles(...FINANCE_ROLES)
  async estatisticas(@Query() filters: TotalQueryDto, @Request() req: any) {
    return this.reportsService.obterEstatisticas(filters, req.user);
  }

  @Get('balances')
  @Roles(...FINANCE_ROLES)
  async balances(@Query() filters: BalancesQueryDto, @Request() req: any) {
    return this.reportsService.obterBalancesPorEvento(filters, req.user);
  }
}

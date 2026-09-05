import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { OrdensQueryDto, SaldoQueryDto, TopProductsQueryDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer'];

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('ordens')
  @Roles(...STAFF_ROLES)
  async ordens(@Query() filters: OrdensQueryDto, @Request() req: any) {
    return this.reportsService.obterOrdens(filters, req.user);
  }

  @Get('saldo')
  @Roles(...STAFF_ROLES)
  async saldo(@Query() filters: SaldoQueryDto) {
    return this.reportsService.obterSaldo(filters);
  }

  @Get('top-products')
  @Roles(...STAFF_ROLES)
  async topProducts(@Query() filters: TopProductsQueryDto, @Request() req: any) {
    return this.reportsService.topProducts(filters, req.user);
  }

  @Get('estatisticas')
  @Roles(...STAFF_ROLES)
  async estatisticas(@Request() req: any) {
    return this.reportsService.obterEstatisticas(req.user);
  }
}
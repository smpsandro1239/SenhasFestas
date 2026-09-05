import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer'];

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('ordens')
  @Roles(...STAFF_ROLES)
  async ordens(@Query() filters: any) {
    return this.reportsService.obterOrdens(filters);
  }

  @Get('saldo')
  @Roles(...STAFF_ROLES)
  async saldo(@Query() filters: any) {
    return this.reportsService.obterSaldo(filters);
  }

  @Get('top-products')
  @Roles(...STAFF_ROLES)
  async topProducts(@Query() filters: any) {
    return this.reportsService.topProducts(filters);
  }

  @Get('estatisticas')
  @Roles(...STAFF_ROLES)
  async estatisticas() {
    return this.reportsService.obterEstatisticas();
  }
}
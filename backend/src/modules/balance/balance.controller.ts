import { Controller, Get, Param, Post, Body, UseGuards, Request, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { LoadBalanceDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'treasurer'];

@Controller('balances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':userId')
  async getBalance(@Param('userId', ParseUUIDPipe) userId: string, @Request() req: any) {
    this.assertCanAccess(req.user, userId);
    return this.balanceService.getBalance(userId);
  }

  @Post(':userId/load')
  @Roles(...STAFF_ROLES)
  async load(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: LoadBalanceDto) {
    return this.balanceService.loadBalance(userId, dto);
  }

  @Get(':userId/history')
  async getHistory(@Param('userId', ParseUUIDPipe) userId: string, @Request() req: any) {
    this.assertCanAccess(req.user, userId);
    return this.balanceService.getBalanceHistory(userId);
  }

  private assertCanAccess(requestUser: any, userId: string) {
    if (requestUser.role === 'client' && requestUser.id !== userId) {
      throw new ForbiddenException('Não pode consultar o saldo de outro utilizador');
    }
  }
}
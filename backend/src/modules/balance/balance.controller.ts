import { Controller, Get, Param, Post, Body, Query, UseGuards, Request, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
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
  async getBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
  ) {
    this.assertCanAccess(req.user, userId);
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.getBalance(userId, eventId);
  }

  @Post(':userId/load')
  @Roles(...STAFF_ROLES)
  async load(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: LoadBalanceDto,
    @Request() req: any,
  ) {
    if (dto.eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    return this.balanceService.loadBalance(userId, dto);
  }

  @Get(':userId/history')
  async getHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
  ) {
    this.assertCanAccess(req.user, userId);
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.getBalanceHistory(userId, eventId);
  }

  private assertCanAccess(requestUser: any, userId: string) {
    if (requestUser.role === 'client' && requestUser.id !== userId) {
      throw new ForbiddenException('Não pode consultar o saldo de outro utilizador');
    }
  }
}
import { Controller, Get, Param, Post, Body, Query, UseGuards, Request, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { LoadBalanceDto, DeductBalanceDto, ReverseLoadDto, ExtendBalanceDto, BalanceEventDto, TransferBalanceDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FINANCE_ROLES } from '../../common/roles';
import { arquivarAuditoria } from '../../common/interceptors/audit.interceptor';

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
    this.assertStaffEventScope(req.user, eventId);
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.getBalance(userId, eventId);
  }

  @Post(':userId/load')
  @Roles(...FINANCE_ROLES)
  async load(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: LoadBalanceDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    this.assertStaffEventScope(req.user, dto.eventId);
    return this.balanceService.loadBalance(userId, dto, req.user, arquivarAuditoria(req));
  }

  @Post(':userId/reverse/:movementId')
  @Roles(...FINANCE_ROLES)
  async reverseLoad(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('movementId', ParseUUIDPipe) movementId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
    @Body() dto?: ReverseLoadDto,
  ) {
    this.assertStaffEventScope(req.user, eventId);
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.reverseLoad(userId, movementId, req.user, dto, arquivarAuditoria(req));
  }

  @Post(':userId/deduct')
  @Roles(...FINANCE_ROLES)
  async deduct(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DeductBalanceDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    this.assertStaffEventScope(req.user, dto.eventId);
    return this.balanceService.deductBalance(userId, dto, req.user, arquivarAuditoria(req));
  }

  @Get(':userId/events')
  @Roles(...FINANCE_ROLES)
  async listEvents(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.balanceService.listBalancesPorEvento(userId, req.user);
  }

  @Get(':userId/history')
  async getHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
  ) {
    this.assertCanAccess(req.user, userId);
    this.assertStaffEventScope(req.user, eventId);
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.getBalanceHistory(userId, eventId);
  }

  @Post(':userId/transfer')
  @Roles(...FINANCE_ROLES)
  async transfer(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: TransferBalanceDto,
    @Request() req: any,
  ) {
    this.assertStaffEventScope(req.user, dto.toEventId);
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.toEventId);
    }
    return this.balanceService.transferBalance(userId, dto, req.user, arquivarAuditoria(req));
  }

  @Post(':userId/extend')
  @Roles(...FINANCE_ROLES)
  async extend(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ExtendBalanceDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    this.assertStaffEventScope(req.user, dto.eventId);
    return this.balanceService.extendBalance(userId, dto, arquivarAuditoria(req));
  }

  @Post(':userId/unarchive')
  @Roles(...FINANCE_ROLES)
  async unarchive(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BalanceEventDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    this.assertStaffEventScope(req.user, dto.eventId);
    return this.balanceService.unarchiveBalance(userId, dto.eventId, arquivarAuditoria(req));
  }

  @Post(':userId/notified')
  @Roles(...FINANCE_ROLES)
  async notified(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BalanceEventDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    this.assertStaffEventScope(req.user, dto.eventId);
    return this.balanceService.markNotified(userId, dto.eventId, arquivarAuditoria(req));
  }

  @Get('event/:eventId/outstanding')
  @Roles(...FINANCE_ROLES)
  async outstanding(@Param('eventId', ParseUUIDPipe) eventId: string, @Request() req: any) {
    return this.balanceService.listSaldosPendentes(eventId, req.user);
  }

  private assertCanAccess(requestUser: any, userId: string) {
    if (requestUser.role === 'client') {
      if (requestUser.id !== userId) {
        throw new ForbiddenException('Não pode consultar o saldo de outro utilizador');
      }
      return;
    }
    if (!FINANCE_ROLES.includes(requestUser.role)) {
      throw new ForbiddenException('Sem permissão para consultar saldos');
    }
  }

  private assertStaffEventScope(requestUser: any, eventId?: string) {
    if (requestUser.role === 'superadmin' || requestUser.role === 'client') {
      return;
    }
    if (!eventId) {
      throw new ForbiddenException('Indique o evento (eventId) para consultar saldos');
    }
  }
}
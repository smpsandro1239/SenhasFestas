import { Controller, Get, Param, Post, Body, Query, UseGuards, Request, ForbiddenException, ParseUUIDPipe, Headers } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { LoadBalanceDto, DeductBalanceDto, ReverseLoadDto, ExtendBalanceDto, BalanceEventDto, TransferBalanceDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FINANCE_ROLES } from '../../common/roles';
import { arquivarAuditoria } from '../../common/interceptors/audit.interceptor';
import { MembershipService } from '../../common/membership.service';

@Controller('balances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get(':userId')
  async getBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
  ) {
    await this.assertCanAccess(req.user, userId, eventId);
    return this.balanceService.getBalance(userId, eventId);
  }

  @Post(':userId/load')
  @Roles(...FINANCE_ROLES)
  async load(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: LoadBalanceDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    return this.balanceService.loadBalance(userId, dto, req.user, arquivarAuditoria(req), idempotencyKey);
  }

  @Post(':userId/reverse/:movementId')
  @Roles(...FINANCE_ROLES)
  async reverseLoad(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('movementId', ParseUUIDPipe) movementId: string,
    @Request() req: any,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
    @Body() dto?: ReverseLoadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (eventId && req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, eventId);
    }
    return this.balanceService.reverseLoad(userId, movementId, req.user, dto, arquivarAuditoria(req), idempotencyKey);
  }

  @Post(':userId/deduct')
  @Roles(...FINANCE_ROLES)
  async deduct(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DeductBalanceDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.eventId);
    }
    return this.balanceService.deductBalance(userId, dto, req.user, arquivarAuditoria(req), idempotencyKey);
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
    await this.assertCanAccess(req.user, userId, eventId);
    return this.balanceService.getBalanceHistory(userId, eventId);
  }

  @Post(':userId/transfer')
  @Roles(...FINANCE_ROLES)
  async transfer(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: TransferBalanceDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (req.user.role !== 'superadmin') {
      await this.balanceService.assertMemberEvent(req.user.id, dto.toEventId);
    }
    return this.balanceService.transferBalance(userId, dto, req.user, arquivarAuditoria(req), idempotencyKey);
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
    return this.balanceService.markNotified(userId, dto.eventId, arquivarAuditoria(req));
  }

  @Get('event/:eventId/outstanding')
  @Roles(...FINANCE_ROLES)
  async outstanding(@Param('eventId', ParseUUIDPipe) eventId: string, @Request() req: any) {
    return this.balanceService.listSaldosPendentes(eventId, req.user);
  }

  private async assertCanAccess(requestUser: any, userId: string, eventId?: string): Promise<void> {
    if (requestUser.role === 'superadmin') {
      return;
    }

    // Sem evento explícito, qualquer utilizador só pode consultar os próprios
    // saldos. Para consultar o saldo de terceiros é obrigatória a role efectiva
    // no evento concreto — nunca a role global do JWT.
    if (!eventId) {
      if (requestUser.id === userId) {
        return;
      }
      throw new ForbiddenException('Indique o evento (eventId) para consultar saldos de terceiros');
    }

    await this.balanceService.assertMemberEvent(requestUser.id, eventId);
    if (requestUser.id === userId) {
      return;
    }

    const role = await this.membershipService.roleEfetiva(requestUser, eventId);
    if (!FINANCE_ROLES.includes(role)) {
      throw new ForbiddenException('A tua função neste evento não permite consultar saldos de terceiros');
    }
  }
}
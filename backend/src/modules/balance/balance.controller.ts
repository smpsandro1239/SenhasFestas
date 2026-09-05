import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { LoadBalanceDto } from './dto';

@Controller('balances')
@UseGuards(AuthGuard('jwt'))
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':userId')
  async getBalance(@Param('userId') userId: string) {
    return this.balanceService.getBalance(userId);
  }

  @Post(':userId/load')
  async load(@Param('userId') userId: string, @Body() dto: LoadBalanceDto) {
    return this.balanceService.loadBalance(userId, dto);
  }

  @Get(':userId/history')
  async getHistory(@Param('userId') userId: string) {
    return this.balanceService.getBalanceHistory(userId);
  }
}
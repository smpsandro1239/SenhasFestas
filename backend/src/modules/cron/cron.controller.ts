import { Controller, Get, Post, Headers, ForbiddenException, Logger } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { BalanceService } from '../balance/balance.service';

const CRON_SECRET_ENV = 'CRON_SECRET';

/**
 * Endpoint usado pelo cron da Vercel (vercel.json → /api/cron/close-events).
 * O Vercel invoca com GET e envia CRON_SECRET como 'Authorization: Bearer <secret>';
 * aceita POST manual (lazy check) com o header x-cron-secret.
 */
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly eventService: EventService,
    private readonly balanceService: BalanceService,
  ) {}

  @Get('close-events')
  async closeEvents(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ fechados: number }> {
    this.assertAutorizado(authorization, secret);
    const fechados = await this.eventService.autoCloseExpired();
    this.logger.log(`Cron close-events executado: ${fechados} evento(s) fechado(s)`);
    return { fechados };
  }

  @Post('close-events')
  async closeEventsPost(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ fechados: number }> {
    return this.closeEvents(authorization, secret);
  }

  @Get('archive-balances')
  async archiveBalances(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ arquivados: number; removidos: number }> {
    this.assertAutorizado(authorization, secret);
    const resultado = await this.balanceService.archiveExpiredBalances();
    this.logger.log(
      `Cron archive-balances executado: ${resultado.arquivados} arquivado(s), ${resultado.removidos} removido(s)`,
    );
    return resultado;
  }

  @Post('archive-balances')
  async archiveBalancesPost(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ arquivados: number; removidos: number }> {
    return this.archiveBalances(authorization, secret);
  }

  private assertAutorizado(authorization?: string, secret?: string): void {
    const esperado = process.env[CRON_SECRET_ENV];
    if (!esperado) {
      throw new ForbiddenException('CRON_SECRET não configurado no servidor');
    }
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const recebido = bearer ?? secret;
    if (!recebido || !this.safeEqual(recebido, esperado)) {
      throw new ForbiddenException('Cron não autorizado');
    }
  }

  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}
import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { EventService } from '../event/event.service';

const CRON_SECRET_ENV = 'CRON_SECRET';

/**
 * Endpoint usado pelo cron da Vercel (vercel.json → POST /api/cron/close-events).
 * Não tem AuthGuard: a autenticação é o header x-cron-secret, comparado em
 * tempo constante com a variável de ambiente CRON_SECRET.
 */
@Controller('cron')
export class CronController {
  constructor(private readonly eventService: EventService) {}

  @Post('close-events')
  async closeEvents(@Headers('x-cron-secret') secret?: string): Promise<{ fechados: number }> {
    const esperado = process.env[CRON_SECRET_ENV];
    if (!esperado || !secret || !this.safeEqual(secret, esperado)) {
      throw new ForbiddenException('Cron não autorizado');
    }
    const fechados = await this.eventService.autoCloseExpired();
    return { fechados };
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
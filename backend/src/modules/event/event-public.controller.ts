import { Controller, Get, Param } from '@nestjs/common';
import { EventService } from './event.service';

// Endpoint público (sem guards) para a rota /entrar/<shortCode> do frontend.
// Registado ANTES do EventController no módulo: '/events/by-code/:shortCode'
// colide com '/events/:id/:action' para códigos literais como 'settings'.
@Controller('events')
export class EventPublicController {
  constructor(private readonly eventService: EventService) {}

  @Get('by-code/:shortCode')
  async findByCode(@Param('shortCode') shortCode: string) {
    return this.eventService.findByCode(shortCode);
  }
}

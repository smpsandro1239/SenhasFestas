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

  // Lista os eventos activos (janela aberta) para o dropdown do /qr-order.
  // Também registado antes do EventController: '/events/public' colidiria
  // com '/events/:id' para um id literal 'public'.
  @Get('public')
  async listPublicos() {
    return this.eventService.listEventosPublicos();
  }
}

import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.orderService.create(req.user, dto);
  }

  @Post(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto.status);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    return this.orderService.cancelOrder(id, req.user.id);
  }

  @Get('event/:eventId')
  async findByEvent(@Param('eventId') eventId: string) {
    return this.orderService.findAll(eventId);
  }
}
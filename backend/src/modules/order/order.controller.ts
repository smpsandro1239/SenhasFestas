import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer'];

@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.orderService.create(req.user, dto);
  }

  @Patch(':id/status')
  @Roles(...STAFF_ROLES)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
    return this.orderService.updateStatus(id, dto.status, req.user);
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.orderService.cancelOrder(id, req.user);
  }

  @Get('event/:eventId')
  @Roles(...STAFF_ROLES)
  async findByEvent(@Param('eventId', ParseUUIDPipe) eventId: string, @Request() req: any) {
    return this.orderService.findByEvent(eventId, req.user);
  }

  @Get()
  async findAll(@Request() req: any, @Query() query: PaginationQueryDto) {
    return this.orderService.findAllForUser(req.user, query.page, query.limit);
  }
}
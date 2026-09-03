import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventService } from './event.service';
import { EventEntity } from '../../entities';
import { CreateEventDto, UpdateEventDto } from './dto';

@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.eventService.findByUser(req.user.id);
  }

  @Post()
  async create(@Request() req: any, @Body() dto: CreateEventDto) {
    return this.eventService.create(req.user, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.eventService.findOne(id, req.user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(id, req.user, dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { status: string },
  ) {
    return this.eventService.updateStatus(id, req.user, body.status);
  }
}
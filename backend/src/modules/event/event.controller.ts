import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto, UpdateEventStatusDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('events')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.eventService.findByUser(req.user.id);
  }

  @Post()
  @Roles('superadmin', 'organizer')
  async create(@Request() req: any, @Body() dto: CreateEventDto) {
    return this.eventService.create(req.user, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.eventService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('superadmin', 'organizer')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(id, req.user, dto);
  }

  @Patch(':id/status')
  @Roles('superadmin', 'organizer')
  async updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.eventService.updateStatus(id, req.user, dto.status);
  }

  @Delete(':id')
  @Roles('superadmin')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.eventService.remove(id, req.user);
  }
}
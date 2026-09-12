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
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto, UpdateEventStatusDto, AddMemberDto, EventSettingsDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MANAGEMENT_ROLES } from '../../common/roles';

@Controller('events')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.eventService.findByUser(req.user);
  }

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(@Request() req: any, @Body() dto: CreateEventDto) {
    return this.eventService.create(req.user, dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.eventService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(...MANAGEMENT_ROLES)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(id, req.user, dto);
  }

  @Patch(':id/status')
  @Roles(...MANAGEMENT_ROLES)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.eventService.updateStatus(id, req.user, dto.status);
  }

  @Get(':id/settings')
  async getSettings(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.eventService.getSettings(id, req.user);
  }

  @Patch(':id/settings')
  @Roles(...MANAGEMENT_ROLES)
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: EventSettingsDto,
  ) {
    return this.eventService.updateSettings(id, req.user, dto);
  }

  @Get(':id/members')
  @Roles(...MANAGEMENT_ROLES)
  async listMembers(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.eventService.listMembers(id, req.user);
  }

  @Post(':id/members')
  @Roles(...MANAGEMENT_ROLES)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: AddMemberDto,
  ) {
    return this.eventService.addMember(id, req.user, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(...MANAGEMENT_ROLES)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.eventService.removeMember(id, req.user, userId);
  }

  @Delete(':id')
  @Roles('superadmin')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.eventService.remove(id, req.user);
  }
}

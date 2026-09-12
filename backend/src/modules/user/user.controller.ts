import { Controller, Get, Post, Param, Patch, Delete, Query, Body, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { STAFF_ROLES, MANAGEMENT_ROLES } from '../../common/roles';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async me(@Request() req: any) {
    const { password: _password, ...safe } = req.user;
    return safe;
  }

  @Get()
  @Roles(...STAFF_ROLES)
  async findAll(@Request() req: any, @Query('q') q?: string) {
    return this.userService.findAll(req.user, q);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.userService.findOne(id, req.user);
  }

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @Roles('superadmin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superadmin')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }
}

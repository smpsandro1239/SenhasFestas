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
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CatalogService } from './catalog.service';
import { CreateProductDto, UpdateProductDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MembershipService } from '../../common/membership.service';
import { MANAGEMENT_ROLES } from '../../common/roles';

@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get()
  async findAll(@Query() query: PaginationQueryDto & { eventId?: string }, @Request() req: any) {
    if (req.user.role === 'client' && !query.eventId) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    if (query.eventId && req.user.role !== 'superadmin') {
      await this.membershipService.assertMember(req.user, query.eventId);
    }
    return this.catalogService.findAll(query.eventId, query.page, query.limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const product = await this.catalogService.findOne(id, req.user);
    if (req.user.role !== 'superadmin' && product.event?.id) {
      await this.membershipService.assertMember(req.user, product.event.id);
    }
    return product;
  }

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.catalogService.create(req.user, dto);
  }

  @Patch(':id')
  @Roles(...MANAGEMENT_ROLES)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.update(id, req.user, dto);
  }

  @Delete(':id')
  @Roles(...MANAGEMENT_ROLES)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.catalogService.softRemove(id, req.user);
  }
}

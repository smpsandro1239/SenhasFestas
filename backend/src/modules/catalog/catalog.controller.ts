import {
  Controller,
  Get,
  Post,
  Patch,
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

@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    return this.catalogService.findAll(query.page, query.limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.catalogService.findOne(id, req.user);
  }

  @Post()
  @Roles('superadmin', 'organizer')
  async create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.catalogService.create(req.user, dto);
  }

  @Patch(':id')
  @Roles('superadmin', 'organizer')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.update(id, req.user, dto);
  }
}

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
import { CatalogService } from './catalog.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.catalogService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.catalogService.findOne(id, req.user);
  }

  @Post()
  async create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.catalogService.create(req.user, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.update(id, req.user, dto);
  }
}

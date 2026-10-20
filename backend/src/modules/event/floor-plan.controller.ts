import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FloorPlanService } from './floor-plan.service';
import { CriarPlantaDto, GuardarPlantaDto, RenomearPlantaDto } from './planta.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MANAGEMENT_ROLES } from '../../common/roles';
import { arquivarAuditoria, definirAuditBefore } from '../../common/interceptors/audit.interceptor';

@Controller('events')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FloorPlanController {
  constructor(private readonly floorPlanService: FloorPlanService) {}

  @Get(':id/plantas')
  @Roles(...MANAGEMENT_ROLES)
  async listar(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.floorPlanService.listar(id, req.user);
  }

  @Post(':id/plantas')
  @Roles(...MANAGEMENT_ROLES)
  async criar(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: CriarPlantaDto,
  ) {
    return this.floorPlanService.criar(id, req.user, dto, arquivarAuditoria(req));
  }

  @Get(':id/plantas/:plantaId')
  @Roles(...MANAGEMENT_ROLES)
  async obter(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Request() req: any,
  ) {
    return this.floorPlanService.obter(id, plantaId, req.user);
  }

  @Put(':id/plantas/:plantaId')
  @Roles(...MANAGEMENT_ROLES)
  async guardar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Request() req: any,
    @Body() dto: GuardarPlantaDto,
  ) {
    return this.floorPlanService.guardar(id, plantaId, req.user, dto, arquivarAuditoria(req));
  }

  @Patch(':id/plantas/:plantaId')
  @Roles(...MANAGEMENT_ROLES)
  async renomear(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Request() req: any,
    @Body() dto: RenomearPlantaDto,
  ) {
    return this.floorPlanService.renomear(id, plantaId, req.user, dto, arquivarAuditoria(req));
  }

  @Delete(':id/plantas/:plantaId')
  @Roles(...MANAGEMENT_ROLES)
  async apagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Request() req: any,
  ) {
    return this.floorPlanService.apagar(id, plantaId, req.user, arquivarAuditoria(req));
  }

  @Get(':id/planta')
  @Roles(...MANAGEMENT_ROLES)
  async obterPrincipal(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.floorPlanService.obterPrincipal(id, req.user);
  }

  @Put(':id/planta')
  @Roles(...MANAGEMENT_ROLES)
  async guardarPrincipal(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: GuardarPlantaDto,
  ) {
    return this.floorPlanService.guardarPrincipal(id, req.user, dto, (anterior) =>
      definirAuditBefore(req, anterior),
    );
  }
}

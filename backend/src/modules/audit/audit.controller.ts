import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const AUDIT_ROLES = ['superadmin', 'organizer', 'treasurer'];

@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(...AUDIT_ROLES)
  async list(@Query() query: AuditQueryDto, @Request() req: any) {
    return this.auditService.list(query, req.user);
  }

  @Get('export.csv')
  @Roles(...AUDIT_ROLES)
  async export(@Query() query: AuditQueryDto, @Request() req: any, @Res() res: Response) {
    const csv = await this.auditService.exportCsv(query, req.user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria.csv"');
    res.send(csv);
  }

  @Get(':id')
  @Roles(...AUDIT_ROLES)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.auditService.findOne(id, req.user);
  }
}

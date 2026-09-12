import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLogEntity } from '../../entities';
import { MembershipService, NO_EVENT } from '../../common/membership.service';
import { snapshot } from '../../common/serializers';
import { AuditQueryDto } from './dto';

export interface AuditRecordInput {
  action: string;
  entity?: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  eventId?: string;
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export const AUDIT_ENTITIES_FINANCEIRAS = [
  'balance',
  'balance-movement',
  'cash-closure',
  'order',
  'reports',
];

export const AUDIT_ACOES_FINANCEIRAS = [
  'LOAD',
  'REVERSAL',
  'CANCEL',
  'CANCELAR',
  'CLOSE',
  'OPEN',
  'EXPORT',
];

const LIMITE_EXPORTACAO = 5000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly membershipService: MembershipService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        actorId: input.actorId ?? undefined,
        actorRole: input.actorRole,
        eventId: input.eventId ?? undefined,
        before: input.before === undefined ? undefined : (snapshot(input.before) as Record<string, any>),
        after: input.after === undefined ? undefined : (snapshot(input.after) as Record<string, any>),
        details: input.details,
        ip: input.ip,
        userAgent: input.userAgent,
      });
      await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.warn(`Falha ao registar auditoria (${input.action}): ${(error as Error).message}`);
    }
  }

  private aplicarEscopo(
    query: SelectQueryBuilder<AuditLogEntity>,
    utilizador: any,
    eventIds: string[] | null,
  ): void {
    if (!utilizador || utilizador.role === 'superadmin') {
      return;
    }
    if (utilizador.role === 'treasurer') {
      const escopo = eventIds && eventIds.length > 0 ? eventIds : [NO_EVENT];
      query.andWhere('log.eventId IN (:...auditEventIds)', { auditEventIds: escopo });
      query.andWhere(
        '(log.entity IN (:...auditEntidades) OR log.action IN (:...auditAcoes))',
        {
          auditEntidades: AUDIT_ENTITIES_FINANCEIRAS,
          auditAcoes: AUDIT_ACOES_FINANCEIRAS,
        },
      );
      return;
    }
    if (utilizador.role === 'organizer') {
      const escopo = eventIds && eventIds.length > 0 ? eventIds : [NO_EVENT];
      query.andWhere(
        '(log.eventId IN (:...auditEventIds) OR log.actorId = :auditActorId)',
        { auditEventIds: escopo, auditActorId: utilizador.id },
      );
      return;
    }
    throw new ForbiddenException('Sem permissão para consultar auditoria');
  }

  private construirQuery(filtros: AuditQueryDto, utilizador: any, eventIds: string[] | null) {
    const query = this.auditLogRepository.createQueryBuilder('log');
    this.aplicarEscopo(query, utilizador, eventIds);

    if (filtros.entity) {
      query.andWhere('log.entity = :entity', { entity: filtros.entity });
    }
    if (filtros.action) {
      query.andWhere('log.action = :action', { action: filtros.action });
    }
    if (filtros.actorId) {
      query.andWhere('log.actorId = :actorId', { actorId: filtros.actorId });
    }
    if (filtros.eventId) {
      if (eventIds !== null && !eventIds.includes(filtros.eventId)) {
        throw new ForbiddenException('Não pertence a este evento');
      }
      query.andWhere('log.eventId = :filtroEventId', { filtroEventId: filtros.eventId });
    }
    return query;
  }

  async list(
    filtros: AuditQueryDto,
    utilizador: any,
  ): Promise<{ items: AuditLogEntity[]; total: number; page: number; limit: number }> {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const query = this.construirQuery(filtros, utilizador, eventIds);
    const [items, total] = await query
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string, utilizador: any): Promise<AuditLogEntity> {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.id = :id', { id });
    this.aplicarEscopo(query, utilizador, eventIds);
    const log = await query.getOne();
    if (!log) {
      throw new NotFoundException('Registo de auditoria não encontrado');
    }
    return log;
  }

  async exportCsv(filtros: AuditQueryDto, utilizador: any): Promise<string> {
    const eventIds = await this.membershipService.eventIdsFor(utilizador);
    const query = this.construirQuery(filtros, utilizador, eventIds);
    const items = await query
      .orderBy('log.createdAt', 'DESC')
      .take(LIMITE_EXPORTACAO)
      .getMany();
    const cabecalho = [
      'createdAt',
      'action',
      'entity',
      'entityId',
      'actorId',
      'actorRole',
      'eventId',
      'ip',
      'before',
      'after',
    ];
    const escapar = (valor: unknown): string => {
      const texto =
        valor === null || valor === undefined
          ? ''
          : typeof valor === 'object'
            ? JSON.stringify(valor)
            : String(valor);
      return `"${texto.replace(/"/g, '""')}"`;
    };
    const linhas = items.map((item) =>
      [
        item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        item.action,
        item.entity,
        item.entityId,
        item.actorId,
        item.actorRole,
        item.eventId,
        item.ip,
        item.before,
        item.after,
      ]
        .map(escapar)
        .join(','),
    );
    return [cabecalho.join(','), ...linhas].join('\n');
  }
}

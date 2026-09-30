import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventUserEntity } from '../entities';

export const NO_EVENT = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
  ) {}

  async eventIdsFor(user: any): Promise<string[] | null> {
    if (!user || user.role === 'superadmin') {
      return null;
    }
    const membros = await this.eventUserRepository.find({
      where: { user: { id: user.id } as any },
      relations: { event: true },
    });
    return membros.map((m) => m.event?.id).filter((id): id is string => Boolean(id));
  }

  async assertMember(user: any, eventId: string): Promise<void> {
    if (!user || user.role === 'superadmin') {
      return;
    }
    const membro = await this.eventUserRepository.findOne({
      where: { event: { id: eventId }, user: { id: user.id } },
    });
    if (!membro) {
      throw new ForbiddenException('Não pertence a este evento');
    }
  }

  /**
   * 2A: role efetiva para autorização.
   * - superadmin global: imune, nunca é reduzida (não consulta a BD).
   * - Com eventId: a event-role é a efetiva; sem membership -> 403.
   * - Sem eventId: se o utilizador tem memberships todas com a mesma role,
   *   essa é a efetiva; com roles diferentes entre eventos ou sem memberships,
   *   usa a role global (comportamento de agregação multi-evento).
   * Consulta por request, sem cache. Freshness da membership > custo. Se um dia
   * houver latência medida, o caminho é cache curto com invalidação no endpoint
   * que altera a membership — não um TTL cego.
   */
  async roleEfetiva(user: any, eventId?: string): Promise<string> {
    if (!user) {
      throw new ForbiddenException('Não autenticado');
    }
    if (user.role === 'superadmin') {
      return 'superadmin';
    }
    if (eventId) {
      const membro = await this.eventUserRepository.findOne({
        where: { event: { id: eventId }, user: { id: user.id } },
      });
      if (!membro) {
        throw new ForbiddenException('Não pertence a este evento');
      }
      return membro.role;
    }
    const membros = await this.eventUserRepository.find({
      where: { user: { id: user.id } as any },
    });
    if (membros.length === 0) {
      return user.role;
    }
    const roles = new Set(membros.map((m) => m.role));
    if (roles.size === 1) {
      return membros[0].role;
    }
    return user.role;
  }

  eventColumnFor(scope: string[] | null, eventId?: string): { column: string; params: Record<string, unknown> } | null {
    if (eventId) {
      if (scope !== null && !scope.includes(eventId)) {
        throw new ForbiddenException('Não pertence a este evento');
      }
      return { column: 'eventId = :scopeEventId', params: { scopeEventId: eventId } };
    }
    if (scope === null) {
      return null;
    }
    if (scope.length > 0) {
      return { column: 'eventId IN (:...scopeEventIds)', params: { scopeEventIds: scope } };
    }
    return { column: 'eventId = :scopeNoEvent', params: { scopeNoEvent: NO_EVENT } };
  }
}
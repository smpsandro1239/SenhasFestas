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

  eventColumnFor(scope: string[] | null, eventId?: string): { column: string; params: Record<string, unknown> } | null {
    if (scope === null) {
      return null;
    }
    if (eventId) {
      if (!scope.includes(eventId)) {
        throw new ForbiddenException('Não pertence a este evento');
      }
      return { column: 'eventId = :scopeEventId', params: { scopeEventId: eventId } };
    }
    if (scope.length > 0) {
      return { column: 'eventId IN (:...scopeEventIds)', params: { scopeEventIds: scope } };
    }
    return { column: 'eventId = :scopeNoEvent', params: { scopeNoEvent: NO_EVENT } };
  }
}
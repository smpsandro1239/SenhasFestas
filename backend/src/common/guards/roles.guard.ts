import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { MembershipService } from '../membership.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membershipService: MembershipService,
  ) {}

  private eventIdsDoRequest(request: any): string[] {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const candidatos = [
      request.params?.eventId,
      request.query?.eventId,
      body.eventId,
      body.fromEventId,
      body.toEventId,
      body.sourceEventId,
      body.targetEventId,
      // Rotas de eventos usam :id para o eventId; outras rotas com :id
      // (orders/:id, products/:id, users/:id) não são o evento.
      request.route?.path?.startsWith('/events/') ? request.params?.id : undefined,
    ];
    return [...new Set(candidatos.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.role) {
      throw new ForbiddenException('Não tem permissões para esta operação');
    }

    // Com evento(s) explícito(s), todas as memberships envolvidas têm de
    // cumprir a role exigida. Em endpoints agregados, todas as memberships do
    // utilizador são verificadas: uma role global não pode elevar uma role
    // restrita noutro evento.
    const rolesEfetivas = await this.membershipService.rolesEfetivas(
      user,
      this.eventIdsDoRequest(request),
    );

    if (!rolesEfetivas.length || !rolesEfetivas.every((role) => requiredRoles.includes(role))) {
      throw new ForbiddenException('Não tem permissões para esta operação');
    }

    return true;
  }
}
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

  private eventIdDoRequest(request: any): string | undefined {
    if (request.params?.eventId) {
      return request.params.eventId;
    }
    if (request.query?.eventId) {
      return request.query.eventId;
    }
    if (request.body && typeof request.body === 'object' && request.body.eventId) {
      return request.body.eventId;
    }
    // Rotas de eventos usam :id para o eventId (ex.: /events/:id/members).
    // Outras rotas com :id (orders/:id, users/:id) não são o evento.
    if (request.route?.path?.startsWith('/events/') && request.params?.id) {
      return request.params.id;
    }
    return undefined;
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

    // 2A: role efetiva = event-role dentro do evento; superadmin global imune.
    // Consulta por request, sem cache. Freshness da membership > custo. Se um
    // dia houver latência medida, o caminho é cache curto com invalidação no
    // endpoint que altera a membership — não um TTL cego.
    const roleEfetiva = await this.membershipService.roleEfetiva(
      user,
      this.eventIdDoRequest(request),
    );

    if (!requiredRoles.includes(roleEfetiva)) {
      throw new ForbiddenException('Não tem permissões para esta operação');
    }

    return true;
  }
}
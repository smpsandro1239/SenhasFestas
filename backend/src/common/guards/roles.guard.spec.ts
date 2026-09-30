import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { MembershipService } from '../membership.service';
import { FINANCE_ROLES, KITCHEN_ROLES, ORDER_CREATOR_ROLES, MANAGEMENT_ROLES } from '../roles';

// RED(2A): o guard atual usa user.role (global). Estes testes exigem que a
// event-role (EventUserEntity.role) substitua a global dentro do evento.

const membrosDB: { id: string; eventId: string; userId: string; role: string }[] = [];

function criarContexto(user: any, requiredRoles: string[], requestExtras: any = {}) {
  const request = {
    user,
    params: {},
    query: {},
    body: undefined,
    route: { path: '' },
    ...requestExtras,
  };
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  return { guard: criarGuard(reflector), context };
}

function criarGuard(reflector: any): RolesGuard {
  const eventUserRepo = {
    find: vi.fn(async (opts?: any) => {
      const userId = opts?.where?.user?.id;
      return membrosDB
        .filter((m) => !userId || m.userId === userId)
        .map((m) => ({ id: m.id, role: m.role, event: { id: m.eventId } }));
    }),
    findOne: vi.fn(async (opts?: any) => {
      const eventId = opts?.where?.event?.id;
      const userId = opts?.where?.user?.id;
      const m = membrosDB.find((x) => x.eventId === eventId && x.userId === userId);
      return m ? { id: m.id, role: m.role, event: { id: m.eventId } } : null;
    }),
  };
  const service = new MembershipService(eventUserRepo as any);
  return new RolesGuard(reflector, service);
}

function adicionarMembro(userId: string, eventId: string, role: string) {
  membrosDB.push({ id: `m${membrosDB.length + 1}`, userId, eventId, role });
}

describe('RolesGuard — 2A: event-role como role efetiva dentro do evento', () => {
  beforeEach(() => {
    membrosDB.length = 0;
  });

  it('1. organizer global + event-role client no evento X → 403 em GET /users (sem eventId)', async () => {
    adicionarMembro('u1', 'evtX', 'client');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'organizer' },
      FINANCE_ROLES,
      { route: { path: '/users' } },
    );

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('1b. organizer global + event-role client no evento X → 403 em GET /reports/ordens?eventId=evtX', async () => {
    adicionarMembro('u1', 'evtX', 'client');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'organizer' },
      FINANCE_ROLES,
      { query: { eventId: 'evtX' }, route: { path: '/reports/ordens' } },
    );

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('1c. organizer global + event-role client no evento X → 403 em GET /events/evtX/members', async () => {
    adicionarMembro('u1', 'evtX', 'client');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'organizer' },
      MANAGEMENT_ROLES,
      { params: { id: 'evtX' }, route: { path: '/events/:id/members' } },
    );

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('2. organizer global + event-role bar no evento X → pode GET /kitchen/pedidos', async () => {
    adicionarMembro('u1', 'evtX', 'bar');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'organizer' },
      KITCHEN_ROLES,
      { route: { path: '/kitchen/pedidos' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('2b. organizer global + event-role bar → 403 em reports/users (FINANCE_ROLES)', async () => {
    adicionarMembro('u1', 'evtX', 'bar');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'organizer' },
      FINANCE_ROLES,
      { query: { eventId: 'evtX' }, route: { path: '/reports/ordens' } },
    );

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('3. client global + event-role cashier no evento X → pode by-access-code', async () => {
    adicionarMembro('u1', 'evtX', 'cashier');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'client' },
      FINANCE_ROLES,
      { params: { code: '123456' }, route: { path: '/users/by-access-code/:code' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('3b. client global + event-role cashier no evento X → pode criar pedido (body eventId)', async () => {
    adicionarMembro('u1', 'evtX', 'cashier');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'client' },
      ORDER_CREATOR_ROLES,
      { body: { eventId: 'evtX', source: 'pos' }, route: { path: '/orders' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('3c. client global + event-role cashier → 403 em evento Y sem membership', async () => {
    adicionarMembro('u1', 'evtX', 'cashier');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'client' },
      ORDER_CREATOR_ROLES,
      { body: { eventId: 'evtY', source: 'pos' }, route: { path: '/orders' } },
    );

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('4. superadmin global + event-role client → continua superadmin (imune, sem consultar BD)', async () => {
    adicionarMembro('u1', 'evtX', 'client');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'superadmin' },
      MANAGEMENT_ROLES,
      { params: { id: 'evtX' }, route: { path: '/events/:id/members' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('4b. superadmin global + event-role bar → continua superadmin (a exceção é a global, não a event-role)', async () => {
    adicionarMembro('u1', 'evtX', 'bar');
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'superadmin' },
      FINANCE_ROLES,
      { query: { eventId: 'evtX' }, route: { path: '/reports/ordens' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('5. mesma pessoa com roles diferentes em dois eventos → comporta-se conforme a role de cada evento', async () => {
    adicionarMembro('u1', 'evtX', 'bar');
    adicionarMembro('u1', 'evtY', 'organizer');

    const { guard: guardBar, context: contextBar } = criarContexto(
      { id: 'u1', role: 'organizer' },
      FINANCE_ROLES,
      { query: { eventId: 'evtX' }, route: { path: '/reports/saldo' } },
    );
    await expect(guardBar.canActivate(contextBar as any)).rejects.toThrow(ForbiddenException);

    const { guard: guardOrg, context: contextOrg } = criarContexto(
      { id: 'u1', role: 'organizer' },
      FINANCE_ROLES,
      { query: { eventId: 'evtY' }, route: { path: '/reports/saldo' } },
    );
    await expect(guardOrg.canActivate(contextOrg as any)).resolves.toBe(true);
  });

  it('sem eventId e sem memberships → usa a role global (comportamento atual)', async () => {
    const { guard, context } = criarContexto(
      { id: 'u1', role: 'client' },
      ORDER_CREATOR_ROLES,
      { route: { path: '/orders' } },
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });
});
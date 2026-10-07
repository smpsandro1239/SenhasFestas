import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { STAFF_ROLES, FINANCE_ROLES } from '../../common/roles';
import { ReportsController } from './reports.controller';
import { UserController } from '../user/user.controller';

// RED(D-2): bar/kitchen não devem ver dados financeiros nem de utilizadores.
// reports/* e users/* (GET) ficam restritos a FINANCE_ROLES.

function rolesDe(target: any, method: string): string[] {
  const handler = target.prototype[method];
  return Reflect.getMetadata(ROLES_KEY, handler) ?? [];
}

describe('D-2 — reports/users restritos a FINANCE_ROLES', () => {
  const endpointsReports = [
    'exportCsv',
    'ordens',
    'saldo',
    'totalVendas',
    'topProducts',
    'seriesVendas',
    'metodosPagamento',
    'resumoMovimentos',
    'estatisticas',
    'balances',
  ];

  it.each(endpointsReports)('reports/%s usa FINANCE_ROLES (não STAFF_ROLES)', (method) => {
    expect(rolesDe(ReportsController, method)).toEqual(FINANCE_ROLES);
  });

  it('reports/* não usa STAFF_ROLES em nenhum endpoint', () => {
    for (const method of endpointsReports) {
      expect(rolesDe(ReportsController, method)).not.toEqual(STAFF_ROLES);
    }
  });

  it.each(['findAll', 'findByAccessCode', 'findOne'])(
    'users/%s usa FINANCE_ROLES (não STAFF_ROLES)',
    (method) => {
      expect(rolesDe(UserController, method)).toEqual(FINANCE_ROLES);
    },
  );

  it('users/me, POST, PATCH e DELETE mantêm as regras atuais', () => {
    const me = rolesDe(UserController, 'me');
    const create = rolesDe(UserController, 'create');
    const update = rolesDe(UserController, 'update');
    const remove = rolesDe(UserController, 'remove');
    expect(me).toEqual([]);
    expect(create).toEqual(['superadmin', 'organizer']);
    expect(update).toEqual(['superadmin']);
    expect(remove).toEqual(['superadmin']);
  });
});

describe('ReportsController — Fila B: balances', () => {
  it('tem roles FINANCE_ROLES em balances', () => {
    expect(rolesDe(ReportsController, 'balances')).toEqual(FINANCE_ROLES);
  });

  it('reports/balances não usa STAFF_ROLES', () => {
    expect(rolesDe(ReportsController, 'balances')).not.toEqual(STAFF_ROLES);
  });
});
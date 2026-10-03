import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KitchenService } from './kitchen/kitchen.service';
import { ReportsService } from './reports/reports.service';

// Invariante: o KDS e o relatorio de estatisticas mostram o mesmo numero de
// "entregues hoje". Divergiram entre si: o KDS filtrava por createdAt e o
// relatorio por updatedAt, sobre os mesmos pedidos.
//
// A divergencia e real e tem uma assimetria importante. createdAt mede quando o
// pedido nasceu; updatedAt mede quando foi gravado por ultimo. Um pedido feito
// as 23h de ontem e entregue as 00h30 de hoje pertence a "hoje" para quem
// trabalha a noite, mas createdAt esconde-o. E o backlog da madrugada —
// exactamente quando o numero importa — que o createdAt subconta sempre.

type Pedido = { id: string; status: string; createdAt: Date; updatedAt: Date };

type Condicao = { sql: string; params: Record<string, any> };
type Chamada = { status: string; condicoes: Condicao[] };

const inicioDeHoje = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

// Dataset minimo que expoe a divergencia: um pedido da madruga que so conta
// com updatedAt, e um pedido entregue hoje que conta com ambos.
const PEDIDOS: Pedido[] = [
  {
    id: 'madruga',
    status: 'delivered',
    createdAt: new Date(inicioDeHoje.getTime() - 4 * 3600_000), // ontem 20:00
    updatedAt: new Date(inicioDeHoje.getTime() + 1 * 3600_000), // hoje 01:00
  },
  {
    id: 'manha',
    status: 'delivered',
    createdAt: new Date(inicioDeHoje.getTime() + 2 * 3600_000), // hoje 02:00
    updatedAt: new Date(inicioDeHoje.getTime() + 3 * 3600_000), // hoje 03:00
  },
  {
    id: 'nao-entregue',
    status: 'ready',
    createdAt: new Date(inicioDeHoje.getTime() + 4 * 3600_000),
    updatedAt: new Date(inicioDeHoje.getTime() + 4 * 3600_000),
  },
];

/** Avalia as condicoes capturadas contra o dataset, como o Postgres faria. */
function contar(chamada: Chamada): number {
  return PEDIDOS.filter((pedido) => {
    if (pedido.status !== chamada.status) return false;
    for (const condicao of chamada.condicoes) {
      const m = /^\w+\.(\w+)\s*>=\s*:(\w+)$/.exec(condicao.sql);
      if (!m) continue;
      const coluna = m[1] as 'createdAt' | 'updatedAt';
      const limite = new Date(condicao.params[m[2]]).getTime();
      if (pedido[coluna].getTime() < limite) return false;
    }
    return true;
  }).length;
}

function criarRepositorioFalso(chamadas: Chamada[]) {
  return {
    createQueryBuilder: () => {
      const registo: Chamada = { status: '', condicoes: [] };
      const qb: any = {
        where(_sql: string, params: any) {
          registo.status = params?.status;
          return qb;
        },
        andWhere(sql: string, params: any) {
          registo.condicoes.push({ sql, params: params ?? {} });
          return qb;
        },
        getCount() {
          chamadas.push(registo);
          return Promise.resolve(contar(registo));
        },
      };
      return qb;
    },
  } as any;
}

const membershipService = {
  eventIdsFor: vi.fn().mockResolvedValue([]),
  eventColumnFor: vi.fn().mockReturnValue(null),
} as any;

const utilizador = { id: 'u1' };

function colunaDaData(chamada: Chamada): string | undefined {
  for (const condicao of chamada.condicoes) {
    const m = /^\w+\.(\w+)\s*>=\s*:/.exec(condicao.sql);
    if (m) return m[1];
  }
  return undefined;
}

const entregues = (chamadas: Chamada[]) =>
  chamadas.find((c) => c.status === 'delivered');

describe('metrica entregues — KDS e relatorio tem de concordar', () => {
  let chamadasKitchen: Chamada[];
  let chamadasReports: Chamada[];
  let statsKitchen: any;
  let statsReports: any;

  beforeEach(async () => {
    chamadasKitchen = [];
    chamadasReports = [];

    const kitchen = new KitchenService(
      criarRepositorioFalso(chamadasKitchen),
      membershipService,
      {} as any,
    );
    const reports = new ReportsService(
      criarRepositorioFalso(chamadasReports),
      {} as any,
      {} as any,
      {} as any,
      membershipService,
    );

    statsKitchen = await kitchen.obterEstatisticas(utilizador);
    statsReports = await reports.obterEstatisticas({}, utilizador);
  });

  it('o KDS nao filtra entregues por createdAt', () => {
    // createdAt mede o nascimento do pedido, nao a entrega. Este foi o bug.
    expect(colunaDaData(entregues(chamadasKitchen)!)).toBe('updatedAt');
  });

  it('os dois servicos filtram entregues pela mesma coluna', () => {
    expect(colunaDaData(entregues(chamadasReports)!)).toBe(
      colunaDaData(entregues(chamadasKitchen)!),
    );
  });

  it('os dois devolvem a mesma contagem de entregues', () => {
    // Com createdAt no KDS este teste dava 1 contra 2. E a divergencia que o
    // utilizador via: o mesmo numero, dois ecrans, resultados diferentes.
    expect(statsKitchen.entregues).toBe(statsReports.entregues);
  });

  it('a contagem inclui um pedido entregue hoje mas criado ontem', () => {
    // O backlog da madrugada. Com createdAt, este pedido desaparecia.
    expect(statsKitchen.entregues).toBe(2);
  });

  it('a contagem nao inclui pedidos ainda nao entregues', () => {
    expect(statsKitchen.entregues).toBe(
      PEDIDOS.filter((p) => p.status === 'delivered').length,
    );
    expect(statsKitchen.entregues).toBeLessThan(
      PEDIDOS.filter((p) => p.status === 'ready').length + statsKitchen.entregues,
    );
  });

  it('os estados não entregues mantem a semantica original, sem filtro de data', () => {
    for (const status of ['received', 'preparing', 'ready']) {
      const chamada = chamadasKitchen.find((c) => c.status === status)!;
      expect(chamada.condicoes).toHaveLength(0);
    }
  });
});
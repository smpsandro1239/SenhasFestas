import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { PublicScreenService } from './public-screen.service';
import { EventUserEntity } from '../../entities';

function queryBuilderMock(resultado: any[]) {
  const qb: any = {
    leftJoinAndSelect: vi.fn(() => qb),
    leftJoin: vi.fn(() => qb),
    select: vi.fn(() => qb),
    where: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    orderBy: vi.fn(() => qb),
    limit: vi.fn(() => qb),
    getMany: vi.fn(() => Promise.resolve(resultado)),
  };
  return qb;
}

function criarServico(qb: any) {
  const orderRepository = { createQueryBuilder: vi.fn(() => qb) } as any;
  return new PublicScreenService(
    orderRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('PublicScreenService — A7: ecrã público não expõe dados financeiros/pessoais', () => {
  it('obterPedidosProntos NÃO seleciona pedido.total nem itens.notes', async () => {
    const qb = queryBuilderMock([]);
    const service = criarServico(qb);

    await service.obterPedidosProntos('evt1');

    const camposSelecionados = qb.select.mock.calls[0][0] as string[];
    expect(camposSelecionados).not.toContain('pedido.total');
    expect(camposSelecionados.some((c) => c.includes('notes'))).toBe(false);
  });

  it('obterPedidosEmPreparação NÃO seleciona pedido.total nem itens.notes', async () => {
    const qb = queryBuilderMock([]);
    const service = criarServico(qb);

    await service.obterPedidosEmPreparacao('evt1');

    const camposSelecionados = qb.select.mock.calls[0][0] as string[];
    expect(camposSelecionados).not.toContain('pedido.total');
    expect(camposSelecionados.some((c) => c.includes('notes'))).toBe(false);
  });

  it('obterPedidosRecebidos NÃO seleciona pedido.total nem itens.notes', async () => {
    const qb = queryBuilderMock([]);
    const service = criarServico(qb);

    await service.obterPedidosRecebidos('evt1');

    const camposSelecionados = qb.select.mock.calls[0][0] as string[];
    expect(camposSelecionados).not.toContain('pedido.total');
    expect(camposSelecionados.some((c) => c.includes('notes'))).toBe(false);
  });

  it('mantém os campos que o ecrã usa (id, status, createdAt, tableNumber)', async () => {
    const qb = queryBuilderMock([]);
    const service = criarServico(qb);

    await service.obterPedidosProntos('evt1');

    const camposSelecionados = qb.select.mock.calls[0][0] as string[];
    expect(camposSelecionados).toContain('pedido.id');
    expect(camposSelecionados).toContain('pedido.status');
    expect(camposSelecionados).toContain('pedido.createdAt');
    expect(camposSelecionados).toContain('pedido.tableNumber');
  });
});

describe('PublicScreenService — autorização transaccional', () => {
  it('recusa entrega se a event-role actual já foi reduzida para client', async () => {
    const manager = {
      findOne: vi.fn()
        .mockResolvedValueOnce({ id: 'o1', status: 'ready', event: { id: 'evt1' } })
        .mockResolvedValueOnce({ id: 'o1', status: 'ready' })
        .mockResolvedValueOnce({ id: 'membership-1', role: 'client' }),
      save: vi.fn(),
    };
    const service = new PublicScreenService(
      {} as any,
      {} as any,
      {} as any,
      { transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)) } as any,
      { emitOrderUpdate: vi.fn() } as any,
    );

    await expect(
      service.marcarEntregue('o1', { id: 'u1', role: 'organizer' }),
    ).rejects.toThrow('A tua função neste evento não permite entregar pedidos');

    expect(manager.findOne).toHaveBeenLastCalledWith(
      EventUserEntity,
      expect.objectContaining({ lock: { mode: 'pessimistic_read' } }),
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('PublicScreenService — snapshot anterior para auditoria (arquivar)', () => {
  it('marcarEntregue arquiva o estado anterior e o evento', async () => {
    const manager = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce({ id: 'o1', status: 'ready', event: { id: 'evt1' } })
        .mockResolvedValueOnce({ id: 'o1', status: 'ready' }),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
    };
    const service = new PublicScreenService(
      {} as any,
      {} as any,
      {} as any,
      { transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)) } as any,
      { emitOrderUpdate: vi.fn() } as any,
    );
    const arquivar = vi.fn();

    await service.marcarEntregue('o1', { id: 'u1', role: 'superadmin' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({ antes: { status: 'ready' }, eventId: 'evt1' });
  });
});
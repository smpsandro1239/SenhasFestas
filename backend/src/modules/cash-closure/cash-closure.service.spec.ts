import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { CashClosureService } from './cash-closure.service';
import { EventService } from '../event/event.service';
import { EventUserEntity } from '../../entities';

function criarDataSource(repository: any, membershipRole = 'cashier') {
  const manager = {
    findOne: vi.fn(async (entity: any, options: any) =>
      entity === EventUserEntity ? { id: 'membership', role: membershipRole } : repository.findOne(options),
    ),
    save: vi.fn(async (_entity: any, value: any) => repository.save(value)),
    find: vi.fn(async (_entity: any, options: any) => repository.find(options)),
  };
  const dataSource = {
    transaction: vi.fn(async (callback: any) => callback(manager)),
  };
  return { dataSource, manager };
}

function criarServico(overrides: { jaAberta?: any } = {}, membershipRole = 'cashier') {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const membershipService = {
    assertMember: vi.fn().mockResolvedValue(undefined),
  } as any;

  const repository = {
    findOne: vi.fn().mockResolvedValue(overrides.jaAberta ?? null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((dto) => dto),
    save: vi.fn().mockImplementation(async (v) => ({ id: 'c1', ...v })),
  } as any;

  const { dataSource, manager } = criarDataSource(repository, membershipRole);

  return {
    service: new CashClosureService(repository, membershipService, eventService, dataSource as any),
    repository,
    eventService,
    manager,
  };
}

describe('CashClosureService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const repository = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    save: vi.fn(),
  } as any;
  const { dataSource } = criarDataSource(repository);
  const cashClosureService = new CashClosureService(
    repository,
    { assertMember: vi.fn().mockResolvedValue(undefined) } as any,
    eventService,
    dataSource as any,
  );

  beforeEach(() => vi.clearAllMocks());

  it('chama assertEventOperavelById ao abrir caixa', async () => {
    (cashClosureService as any).cashClosureRepository.create = vi.fn().mockReturnValue({});
    (cashClosureService as any).cashClosureRepository.save = vi.fn().mockResolvedValue({ id: 'c1' });

    await cashClosureService.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any);

    expect(eventService.assertEventOperavelById).toHaveBeenCalledTimes(1);
    expect(eventService.assertEventOperavelById).toHaveBeenCalledWith('evt1');
  });

  it('bloqueia a abertura quando a janela fechou', async () => {
    (eventService.assertEventOperavelById as any).mockRejectedValueOnce(
      new ForbiddenException('Fora da janela'),
    );

    await expect(
      cashClosureService.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect((cashClosureService as any).cashClosureRepository.save).not.toHaveBeenCalled();
  });
});

describe('A9 — unicidade de caixa aberta por evento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa com 409 se já existe uma caixa aberta no evento', async () => {
    const { service, repository } = criarServico({ jaAberta: { id: 'c-existente', status: 'open' } });

    await expect(
      service.abrirCaixa('op2', { id: 'op2', role: 'cashier' }, { eventId: 'evt1' } as any),
    ).rejects.toThrow(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('recusa abrir caixa quando a event-role actual já foi reduzida para client', async () => {
    const { service, repository, manager } = criarServico({}, 'client');

    await expect(
      service.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any),
    ).rejects.toThrow('A tua função neste evento não permite operações de caixa');

    expect(manager.findOne).toHaveBeenCalledWith(
      EventUserEntity,
      expect.objectContaining({ lock: { mode: 'pessimistic_read' } }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('a mensagem de 409 é clara para o operador', async () => {
    const { service } = criarServico({ jaAberta: { id: 'c-existente', status: 'open' } });

    await expect(
      service.abrirCaixa('op2', { id: 'op2', role: 'cashier' }, { eventId: 'evt1' } as any),
    ).rejects.toThrow(/caixa aberta/i);
  });

  it('abre a caixa quando não existe nenhuma aberta', async () => {
    const { service, repository } = criarServico();

    await service.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any);

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt1', openedById: 'op1', status: 'open' }),
    );
  });

  it('converte a violação do índice único em HTTP 409 quando duas aberturas correm em simultâneo', async () => {
    const { service, repository } = criarServico();
    repository.save.mockRejectedValue({ code: '23505' });

    await expect(
      service.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('obterCaixaAberta ordena por openedAt DESC (determinístico mesmo com duplicados legados)', async () => {
    const { service, repository } = criarServico();

    await service.obterCaixaAberta('evt1', { id: 'op1', role: 'cashier' });

    expect(manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      {
        where: { eventId: 'evt1', status: 'open' },
        order: { openedAt: 'DESC' },
      },
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      EventUserEntity,
      expect.objectContaining({ lock: { mode: 'pessimistic_read' } }),
    );
  });
});

describe('T44 — isolamento transaccional das consultas de caixa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista fechos apenas enquanto a membership está bloqueada na transacção', async () => {
    const { service, manager, repository } = criarServico();
    await service.listarPorEvento('evt1', { id: 'member-1', role: 'client' });
    expect(manager.findOne).toHaveBeenCalledWith(
      EventUserEntity,
      expect.objectContaining({
        where: { event: { id: 'evt1' }, user: { id: 'member-1' } },
        lock: { mode: 'pessimistic_read' },
      }),
    );
    expect(manager.find).toHaveBeenCalledWith(
      expect.anything(),
      { where: { eventId: 'evt1' }, order: { openedAt: 'DESC' } },
    );
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('não devolve um fecho quando a membership já foi removida', async () => {
    const { service, manager, repository } = criarServico();
    manager.findOne.mockImplementation(async (entity: any) =>
      entity === EventUserEntity ? null : { id: 'c1', eventId: 'evt1' },
    );
    await expect(service.obterPorId('c1', { id: 'member-1', role: 'client' }))
      .rejects.toThrow('Não pertence a este evento');
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('permite ao superadmin consultar sem membership de evento', async () => {
    const { service, manager } = criarServico();
    await service.obterCaixaAberta('evt1', { id: 'root', role: 'superadmin' });
    expect(manager.findOne).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ where: { eventId: 'evt1', status: 'open' } }),
    );
  });
});

describe('A9 — fecho: operador que abriu OU superadmin', () => {
  beforeEach(() => vi.clearAllMocks());

  function caixaAberta(overrides: any = {}) {
    return {
      id: 'c1',
      eventId: 'evt1',
      openedById: 'op1',
      status: 'open',
      openedAt: new Date('2026-01-01T10:00:00Z'),
      closedAt: undefined,
      closingBalance: undefined,
      ...overrides,
    };
  }

  it('o operador que abriu pode fechar e fica registado como closedById', async () => {
    const { service, repository } = criarServico({ jaAberta: caixaAberta() });

    const resultado = await service.fecharCaixa(
      'c1',
      'op1',
      { id: 'op1', role: 'cashier' },
      { totalActual: 100 } as any,
    );

    expect(resultado.status).toBe('closed');
    expect(resultado.closedById).toBe('op1');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect((service as any).dataSource.transaction).toHaveBeenCalledOnce();
  });

  it('outro cashier NÃO pode fechar a caixa de outro operador', async () => {
    const { service, repository } = criarServico({ jaAberta: caixaAberta() });

    await expect(
      service.fecharCaixa('c1', 'op2', { id: 'op2', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('recusa fechar caixa quando a event-role actual já foi reduzida para client', async () => {
    const { service, repository, manager } = criarServico({ jaAberta: caixaAberta() }, 'client');

    await expect(
      service.fecharCaixa('c1', 'op1', { id: 'op1', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow('A tua função neste evento não permite operações de caixa');

    expect(manager.findOne).toHaveBeenCalledWith(
      EventUserEntity,
      expect.objectContaining({ lock: { mode: 'pessimistic_read' } }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('a mensagem de 403 explica quem pode fechar', async () => {
    const { service } = criarServico({ jaAberta: caixaAberta() });

    await expect(
      service.fecharCaixa('c1', 'op2', { id: 'op2', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow(/operador que abriu|superadmin/i);
  });

  it('superadmin fecha a caixa de um operador que desapareceu', async () => {
    const { service } = criarServico({ jaAberta: caixaAberta({ openedById: 'op-desaparecido' }) });

    const resultado = await service.fecharCaixa(
      'c1',
      'root',
      { id: 'root', role: 'superadmin' },
      { totalActual: 100 } as any,
    );

    expect(resultado.status).toBe('closed');
    expect(resultado.closedById).toBe('root');
    // openedById preservado: são informações diferentes (quem abriu / quem fechou)
    expect(resultado.openedById).toBe('op-desaparecido');
  });

  it('o fecho arquiva o before, o eventId e quem abriu (o interceptor grava)', async () => {
    const { service } = criarServico({
      jaAberta: caixaAberta({ openedById: 'op-desaparecido' }),
    });
    const arquivar = vi.fn();

    await service.fecharCaixa(
      'c1',
      'root',
      { id: 'root', role: 'superadmin' },
      { totalActual: 100 } as any,
      arquivar,
    );

    expect(arquivar).toHaveBeenCalledWith(
      expect.objectContaining({
        antes: expect.objectContaining({ status: 'open', closedById: null }),
        eventId: 'evt1',
        extras: expect.objectContaining({ abertoPor: 'op-desaparecido', fechoPorSuperadmin: true }),
      }),
    );
  });

  it('abrir a caixa arquiva o snapshot para o interceptor gravar o audit', async () => {
    const { service } = criarServico();
    const arquivar = vi.fn();

    await service.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any, arquivar);

    expect(arquivar).toHaveBeenCalledTimes(1);
    expect(arquivar).toHaveBeenCalledWith({ entidadeId: 'c1', eventId: 'evt1' });
  });

  it('não fecha uma caixa já fechada', async () => {
    const { service } = criarServico({ jaAberta: caixaAberta({ status: 'closed' }) });

    await expect(
      service.fecharCaixa('c1', 'op1', { id: 'op1', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow(ConflictException);
  });
});
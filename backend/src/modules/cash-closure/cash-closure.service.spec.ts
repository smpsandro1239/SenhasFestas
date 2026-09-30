import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { CashClosureService } from './cash-closure.service';
import { EventService } from '../event/event.service';

function criarServico(overrides: { jaAberta?: any } = {}) {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const membershipService = {
    assertMember: vi.fn().mockResolvedValue(undefined),
  } as any;

  const repository = {
    findOne: vi.fn().mockResolvedValue(overrides.jaAberta ?? null),
    create: vi.fn().mockImplementation((dto) => dto),
    save: vi.fn().mockImplementation(async (v) => ({ id: 'c1', ...v })),
  } as any;

  const auditService = { record: vi.fn().mockResolvedValue(undefined) } as any;

  return {
    service: new CashClosureService(repository, membershipService, eventService, auditService),
    repository,
    eventService,
    auditService,
  };
}

describe('CashClosureService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const cashClosureService = new CashClosureService(
    { findOne: vi.fn().mockResolvedValue(null), create: vi.fn(), save: vi.fn() } as any,
    {
      assertMember: vi.fn().mockResolvedValue(undefined),
    } as any,
    eventService,
    { record: vi.fn() } as any,
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

  it('obterCaixaAberta ordena por openedAt DESC (determinístico mesmo com duplicados legados)', async () => {
    const { service, repository } = criarServico();

    await service.obterCaixaAberta('evt1', { id: 'op1', role: 'cashier' });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { eventId: 'evt1', status: 'open' },
      order: { openedAt: 'DESC' },
    });
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
  });

  it('outro cashier NÃO pode fechar a caixa de outro operador', async () => {
    const { service, repository } = criarServico({ jaAberta: caixaAberta() });

    await expect(
      service.fecharCaixa('c1', 'op2', { id: 'op2', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow(ForbiddenException);
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

  it('o audit regista actorId = quem fechou (superadmin), mantendo o before', async () => {
    const { service, auditService } = criarServico({
      jaAberta: caixaAberta({ openedById: 'op-desaparecido' }),
    });

    await service.fecharCaixa('c1', 'root', { id: 'root', role: 'superadmin' }, { totalActual: 100 } as any);

    expect(auditService.record).toHaveBeenCalledTimes(1);
    const entrada = auditService.record.mock.calls[0][0];
    expect(entrada.actorId).toBe('root');
    expect(entrada.entityId).toBe('c1');
    expect(entrada.eventId).toBe('evt1');
    expect(entrada.before).toMatchObject({ status: 'open' });
  });

  it('abrir a caixa também fica registada no audit', async () => {
    const { service, auditService } = criarServico();

    await service.abrirCaixa('op1', { id: 'op1', role: 'cashier' }, { eventId: 'evt1' } as any);

    expect(auditService.record).toHaveBeenCalledTimes(1);
    expect(auditService.record.mock.calls[0][0].actorId).toBe('op1');
  });

  it('não fecha uma caixa já fechada', async () => {
    const { service } = criarServico({ jaAberta: caixaAberta({ status: 'closed' }) });

    await expect(
      service.fecharCaixa('c1', 'op1', { id: 'op1', role: 'cashier' }, { totalActual: 100 } as any),
    ).rejects.toThrow(ConflictException);
  });
});
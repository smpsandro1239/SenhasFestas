import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CashClosureService } from './cash-closure.service';
import { EventService } from '../event/event.service';

describe('CashClosureService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const cashClosureService = new CashClosureService(
    {} as any,
    {
      assertMember: vi.fn().mockResolvedValue(undefined),
    } as any,
    eventService,
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
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventUserEntity } from '../../entities';
import { BalanceService } from './balance.service';

function criarService() {
  return new BalanceService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('BalanceService — membership dentro da transação financeira', () => {
  it('bloqueia a membership com FOR SHARE antes de permitir a operação', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue({ id: 'membership-1' }),
    };

    await (criarService() as any).assertMemberEventInTransaction(
      manager,
      'operator-1',
      'event-1',
    );

    expect(manager.findOne).toHaveBeenCalledWith(EventUserEntity, {
      where: {
        user: { id: 'operator-1' },
        event: { id: 'event-1' },
      },
      lock: { mode: 'pessimistic_read' },
    });
  });

  it('rejeita a operação se a membership foi removida antes de obter o lock', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue(null),
    };

    await expect(
      (criarService() as any).assertMemberEventInTransaction(
        manager,
        'operator-1',
        'event-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

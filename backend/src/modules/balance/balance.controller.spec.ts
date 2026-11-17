import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { MembershipService } from '../../common/membership.service';

describe('BalanceController — isolamento por event-role', () => {
  const balanceService = {
    assertMemberEvent: vi.fn().mockResolvedValue(undefined),
    getBalance: vi.fn().mockResolvedValue({ balance: 25 }),
    getBalanceHistory: vi.fn().mockResolvedValue([]),
  } as unknown as BalanceService;
  const membershipService = {
    roleEfetiva: vi.fn(),
  } as unknown as MembershipService;
  let controller: BalanceController;

  beforeEach(() => {
    vi.clearAllMocks();
    (balanceService.assertMemberEvent as any).mockResolvedValue(undefined);
    (balanceService.getBalance as any).mockResolvedValue({ balance: 25 });
    (membershipService.roleEfetiva as any).mockResolvedValue('cashier');
    controller = new BalanceController(balanceService, membershipService);
  });

  it('não permite que organizer global consulte saldo de terceiros onde é client', async () => {
    (membershipService.roleEfetiva as any).mockResolvedValue('client');

    await expect(
      controller.getBalance('u2', { user: { id: 'u1', role: 'organizer' } }, 'evt1'),
    ).rejects.toThrow(ForbiddenException);

    expect(balanceService.getBalance).not.toHaveBeenCalled();
  });

  it('permite a role cashier do evento mesmo que a role global seja client', async () => {
    await expect(
      controller.getBalance('u2', { user: { id: 'u1', role: 'client' } }, 'evt1'),
    ).resolves.toEqual({ balance: 25 });

    expect(balanceService.assertMemberEvent).toHaveBeenCalledWith('u1', 'evt1');
    expect(membershipService.roleEfetiva).toHaveBeenCalledWith(
      { id: 'u1', role: 'client' },
      'evt1',
    );
  });

  it('sem eventId só permite consultar os próprios saldos', async () => {
    await expect(
      controller.getBalance('u2', { user: { id: 'u1', role: 'organizer' } }),
    ).rejects.toThrow('Indique o evento');

    await expect(
      controller.getBalance('u1', { user: { id: 'u1', role: 'client' } }),
    ).resolves.toEqual({ balance: 25 });
  });
});

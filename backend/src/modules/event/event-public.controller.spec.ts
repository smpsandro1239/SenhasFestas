import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EventPublicController } from './event-public.controller';

describe('EventPublicController — GET /events/by-code/:shortCode', () => {
  it('devolve {id, name, shortCode} através do service', async () => {
    const servico = {
      findByCode: vi.fn().mockResolvedValue({ id: 'e1', name: 'Festa', shortCode: 'festa-2026' }),
    };
    const controller = new EventPublicController(servico as any);

    await expect(controller.findByCode('festa-2026')).resolves.toEqual({
      id: 'e1',
      name: 'Festa',
      shortCode: 'festa-2026',
    });
    expect(servico.findByCode).toHaveBeenCalledWith('festa-2026');
  });

  it('propaga o 404 do serviço', async () => {
    const servico = {
      findByCode: vi.fn().mockRejectedValue(new NotFoundException('Evento não encontrado')),
    };
    const controller = new EventPublicController(servico as any);

    await expect(controller.findByCode('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { OrdensQueryDto } from './dto';

// RED(B6): o frontend envia from/to em vendas; o DTO rejeita com
// forbidNonWhitelisted (400) e o service nem filtra por datas.

describe('OrdensQueryDto — filtro de datas (B6)', () => {
  it('aceita from/to (datas ISO) como em TopProductsQueryDto/TotalQueryDto', async () => {
    const dto = new OrdensQueryDto();
    dto.eventId = '11111111-1111-4111-8111-111111111111';
    dto.from = '2026-09-01T00:00:00.000Z';
    dto.to = '2026-09-30T23:59:59.999Z';

    const erros = await validate(dto);
    expect(erros).toEqual([]);
  });

  it('valida datas inválidas', async () => {
    const dto = new OrdensQueryDto();
    dto.from = 'nao-e-uma-data';

    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'from')).toBe(true);
  });
});
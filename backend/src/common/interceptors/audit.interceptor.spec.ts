import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { AuditInterceptor, definirAuditBefore } from './audit.interceptor';

const EVENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function fazerReq(metodo: string, caminho: string) {
  return {
    method: metodo,
    originalUrl: caminho,
    url: caminho,
    params: {},
    headers: { 'user-agent': 'vitest' },
    ip: '127.0.0.1',
    user: { id: 'u1', role: 'organizer' },
  } as any;
}

function fazerContexto(req: any) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as any;
}

describe('AuditInterceptor — before/after', () => {
  let record: ReturnType<typeof vi.fn>;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    record = vi.fn().mockResolvedValue(undefined);
    interceptor = new AuditInterceptor({ record } as any);
  });

  async function correr(req: any, resposta: unknown) {
    await lastValueFrom(
      interceptor.intercept(fazerContexto(req), { handle: () => of(resposta) } as any),
    );
  }

  it('grava o before arquivado pelo serviço junto do after', async () => {
    const req = fazerReq('PUT', `/api/events/${EVENT_ID}/planta`);
    const antes = { mesas: [{ id: 'mesa-antiga' }], zonas: [], version: 4 };
    definirAuditBefore(req, antes);
    const depois = { mesas: [{ id: 'nova' }], zonas: [], version: 5 };

    await correr(req, depois);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PLANTA',
        entity: 'event',
        entityId: EVENT_ID,
        eventId: EVENT_ID,
        before: antes,
        after: depois,
      }),
    );
  });

  it('sem before arquivado regista apenas o after (comportamento antigo)', async () => {
    const req = fazerReq('PUT', `/api/events/${EVENT_ID}/planta`);

    await correr(req, { mesas: [], zonas: [], version: 1 });

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ after: { mesas: [], zonas: [], version: 1 } }));
    expect(record.mock.calls[0][0].before).toBeUndefined();
  });

  it('resumoResposta corta um before extenso em vez de guardar tudo', async () => {
    const req = fazerReq('PUT', `/api/events/${EVENT_ID}/planta`);
    const gigante = Array.from({ length: 400 }, (_, i) => ({ id: `mesa-${i}`, nome: 'M'.repeat(40) }));
    definirAuditBefore(req, { mesas: gigante, zonas: [], version: 1 });

    await correr(req, { ok: true });

    expect(record.mock.calls[0][0].before).toEqual(
      expect.objectContaining({ resumo: 'resposta extensa' }),
    );
  });
});

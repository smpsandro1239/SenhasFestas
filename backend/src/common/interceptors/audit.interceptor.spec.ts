import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import {
  AuditInterceptor,
  definirAuditBefore,
  definirAuditEvento,
  arquivarAuditoria,
} from './audit.interceptor';

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

  it('funde os extras arquivados pelo serviço em details', async () => {
    const req = fazerReq('PATCH', `/api/products/${EVENT_ID}/stock`);
    definirAuditBefore(req, { stock: 3 }, { motivo: 'quebra', delta: 2 });

    await correr(req, { ok: true });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ motivo: 'quebra', delta: 2, method: 'PATCH' }),
      }),
    );
  });

  it('sem extras em details mantém o comportamento antigo', async () => {
    const req = fazerReq('PUT', `/api/events/${EVENT_ID}/planta`);
    definirAuditBefore(req, { version: 1 });

    await correr(req, { ok: true });

    expect(record.mock.calls[0][0].details).not.toHaveProperty('motivo');
  });

  it('usa o eventId arquivado pelo serviço quando o body não o traz', async () => {
    // /products/:id/stock não tem eventId no path nem no body; só o serviço
    // sabe o evento do produto. Sem este override o log saía sem eventId.
    const req = fazerReq('PATCH', `/api/products/${EVENT_ID}/stock`);
    definirAuditEvento(req, EVENT_ID);

    await correr(req, { ok: true });

    expect(record.mock.calls[0][0].eventId).toBe(EVENT_ID);
  });

  it('usa o entityId arquivado pelo serviço quando o path não o traz', async () => {
    // POST /cash-closure/abrir cria o registo cujo id só o serviço conhece.
    const req = fazerReq('POST', '/api/cash-closure/abrir');
    arquivarAuditoria(req)({ entidadeId: EVENT_ID, eventId: EVENT_ID });

    await correr(req, { id: EVENT_ID });

    expect(record.mock.calls[0][0].entityId).toBe(EVENT_ID);
    expect(record.mock.calls[0][0].action).toBe('OPEN');
  });

  it('arquivarAuditoria aceita um snapshot sem estado anterior (criação)', async () => {
    const req = fazerReq('POST', '/api/cash-closure/abrir');
    arquivarAuditoria(req)({ entidadeId: EVENT_ID, eventId: EVENT_ID, extras: { origem: 'caixa' } });

    await correr(req, { id: EVENT_ID });

    expect(record.mock.calls[0][0].before).toBeUndefined();
    expect(record.mock.calls[0][0].details).toMatchObject({ origem: 'caixa' });
  });

  it('mutações em /plantas/:plantaId ficam com acção PLANTA', async () => {
    // O path termina num uuid, por isso o sufixo '/planta' não apanha: a regra
    // por segmento é que mapeia criar/renomear/apagar para PLANTA.
    const req = fazerReq('POST', `/api/events/${EVENT_ID}/plantas`);
    arquivarAuditoria(req)({ entidadeId: EVENT_ID, eventId: EVENT_ID, extras: { nome: 'Esplanada' } });

    await correr(req, { id: 'planta-nova' });

    expect(record.mock.calls[0][0].action).toBe('PLANTA');
    expect(record.mock.calls[0][0].entity).toBe('event');
  });

  it('PUT /plantas/:plantaId usa o entityId (planta) e o eventId do path', async () => {
    const PLANTA_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
    const req = fazerReq('PUT', `/api/events/${EVENT_ID}/plantas/${PLANTA_ID}`);
    arquivarAuditoria(req)({ entidadeId: PLANTA_ID, eventId: EVENT_ID });

    await correr(req, { id: PLANTA_ID });

    expect(record.mock.calls[0][0].action).toBe('PLANTA');
    expect(record.mock.calls[0][0].entityId).toBe(PLANTA_ID);
    expect(record.mock.calls[0][0].eventId).toBe(EVENT_ID);
  });
});

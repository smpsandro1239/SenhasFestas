import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, lastValueFrom, throwError } from 'rxjs';
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
  it('usa o id devolvido para auditar criações de eventos', async () => {
    const req = fazerReq('POST', '/api/events');
    await correr(req, { id: EVENT_ID, name: 'Festa' });

    expect(record.mock.calls[0][0]).toEqual(
      expect.objectContaining({ entity: 'event', entityId: EVENT_ID, eventId: EVENT_ID }),
    );
  });

  it('usa os ids devolvidos para auditar criações de pedidos e utilizadores', async () => {
    const ORDER_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
    const USER_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
    const orderReq = fazerReq('POST', '/api/orders');
    await correr(orderReq, { id: ORDER_ID, event: { id: EVENT_ID } });

    expect(record.mock.calls[0][0]).toEqual(
      expect.objectContaining({ entity: 'order', entityId: ORDER_ID, eventId: EVENT_ID }),
    );

    const userReq = fazerReq('POST', '/api/users');
    await correr(userReq, { id: USER_ID });

    expect(record.mock.calls[1][0]).toEqual(
      expect.objectContaining({ entity: 'user', entityId: USER_ID }),
    );
    expect(record.mock.calls[1][0].eventId).toBeUndefined();
  });

  it('classifica importações, duplicações e alterações de membros com acções específicas', async () => {
    await correr(fazerReq('POST', '/api/products/import'), { imported: 2 });
    await correr(fazerReq('POST', `/api/products/${EVENT_ID}/duplicate`), { id: EVENT_ID });
    await correr(fazerReq('DELETE', `/api/events/${EVENT_ID}/members/${USER_ID}`), { ok: true });

    expect(record.mock.calls.map((call) => call[0].action)).toEqual([
      'IMPORT',
      'DUPLICATE',
      'MEMBER',
    ]);
  });

  it('usa os overrides de entidade e evento também quando a operação falha', async () => {
    const req = fazerReq('POST', '/api/cash-closure/abrir');
    arquivarAuditoria(req)({ entidadeId: EVENT_ID, eventId: EVENT_ID });
    const contexto = fazerContexto(req);
    const observable = interceptor.intercept(
      contexto,
      { handle: () => throwError(() => new Error('falha')) } as any,
    );

    await expect(lastValueFrom(observable)).rejects.toThrow('falha');
    expect(record.mock.calls[0][0]).toEqual(
      expect.objectContaining({ entityId: EVENT_ID, eventId: EVENT_ID }),
    );
  });

  it('aguarda a persistência da auditoria antes de emitir a resposta HTTP', async () => {
    let concluir!: () => void;
    record.mockImplementation(() => new Promise<void>((resolve) => { concluir = resolve; }));
    const req = fazerReq('POST', '/api/orders');
    let respostaEmitida = false;

    const resposta = lastValueFrom(
      interceptor.intercept(fazerContexto(req), { handle: () => of({ id: 'order-1' }) } as any),
    ).then((valor) => {
      respostaEmitida = true;
      return valor;
    });

    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(1);
    expect(respostaEmitida).toBe(false);

    concluir();
    await expect(resposta).resolves.toEqual({ id: 'order-1' });
    expect(respostaEmitida).toBe(true);
  });

  it('remove access tokens, refresh tokens e passwords dos snapshots sem alterar a resposta', async () => {
    const req = fazerReq('POST', '/api/auth/login');
    const resposta = {
      token: 'access-token-secreto',
      user: {
        id: 'user-1',
        email: 'teste@example.com',
        passwordHash: 'hash-secreto',
        accessCode: '123456',
        profile: { refreshToken: 'refresh-token-secreto', pin: '4321' },
      },
    };

    const resultado = await lastValueFrom(
      interceptor.intercept(fazerContexto(req), { handle: () => of(resposta) } as any),
    );

    expect(resultado).toBe(resposta);
    expect(record.mock.calls[0][0].after).toEqual({
      token: '[REDACTED]',
      user: {
        id: 'user-1',
        email: 'teste@example.com',
        passwordHash: '[REDACTED]',
        accessCode: '[REDACTED]',
        profile: { refreshToken: '[REDACTED]', pin: '[REDACTED]' },
      },
    });
    expect(JSON.stringify(record.mock.calls[0][0].after)).not.toContain('secreto');
  });

  it('remove credenciais de extras e strings Bearer/JWT dos detalhes', async () => {
    const req = fazerReq('POST', '/api/auth/refresh');
    const jwt = 'eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk';
    arquivarAuditoria(req)({
      extras: {
        authorization: 'Bearer access-secret',
        integration: { apiKey: 'api-secret', note: `Authorization: Bearer ${jwt}` },
      },
    });

    await correr(req, { success: true });

    const details = record.mock.calls[0][0].details;
    expect(details.authorization).toBe('[REDACTED]');
    expect(details.integration.apiKey).toBe('[REDACTED]');
    expect(details.integration.note).toContain('Bearer [JWT REDACTED]');
    expect(details.integration.note).toContain('[JWT REDACTED]');
    expect(JSON.stringify(details)).not.toContain('api-secret');
    expect(JSON.stringify(details)).not.toContain(jwt);
  });

  it('não persiste mensagens de erro potencialmente sensíveis', async () => {
    const req = fazerReq('POST', '/api/auth/login');
    const erro = new Error('connection failed with password=super-secret');
    const contexto = fazerContexto(req);
    const observable = interceptor.intercept(
      contexto,
      { handle: () => throwError(() => erro) } as any,
    );

    await expect(lastValueFrom(observable)).rejects.toBe(erro);
    expect(record.mock.calls[0][0].details.erro).toBe('Error');
    expect(JSON.stringify(record.mock.calls[0][0].details)).not.toContain('super-secret');
  });

});

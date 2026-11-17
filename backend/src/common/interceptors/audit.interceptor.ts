import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable, throwError } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../../modules/audit/audit.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O serviço não tem acesso ao `req`, por isso o controller arquiva aqui o
 * snapshot do estado anterior; o interceptor lê-o e grava o `before`.
 */
export const AUDIT_BEFORE = Symbol('auditBefore');

/**
 * Metadados extra (ex.: motivo do ajuste de stock, lados de uma transferência)
 * que o serviço não consegue derivar do `req`; são fundidos em `details`.
 */
export const AUDIT_DETAILS_EXTRAS = Symbol('auditDetailsExtras');

/**
 * `eventId` que o serviço conhece mas não está no path nem no body (ex.:
 * evento do produto num ajuste de stock, evento de uma caixa a fechar). Sem
 * isto o log ficaria sem eventId e sairia do escopo do tesoureiro.
 */
export const AUDIT_EVENT_ID = Symbol('auditEventId');

export function definirAuditBefore(
  req: Request,
  antes: unknown,
  extras?: Record<string, unknown>,
): void {
  (req as any)[AUDIT_BEFORE] = antes;
  if (extras !== undefined) {
    (req as any)[AUDIT_DETAILS_EXTRAS] = extras;
  }
}

export function definirAuditEvento(req: Request, eventId: string | undefined): void {
  (req as any)[AUDIT_EVENT_ID] = eventId;
}

/**
 * `entityId` que só o serviço conhece (ex.: o id da caixa acabada de criar,
 * numa rota cujo path não leva id).
 */
export const AUDIT_ENTITY_ID = Symbol('auditEntityId');

export function definirAuditEntidade(req: Request, entityId: string | undefined): void {
  (req as any)[AUDIT_ENTITY_ID] = entityId;
}

/**
 * O que o serviço sabe sobre a mutação e o pedido não: estado anterior, evento
 * e metadados. O serviço passa-o ao controller (callback) e o controller
 * arquiva-o no `req` para o interceptor gravar — sem o serviço depender do
 * `AuditService` (evita o registo duplicado).
 */
export interface SnapshotAuditoria {
  antes?: unknown;
  eventId?: string;
  entidadeId?: string;
  extras?: Record<string, unknown>;
}

/**
 * Fecha o callback que os serviços aceitam: arquiva o snapshot do estado
 * anterior (e o evento, quando o serviço o conhece) no `req` para o
 * interceptor gravar. Os controllers limitam-se a passar `arquivarAuditoria(req)`.
 */
export function arquivarAuditoria(req: Request): (snapshot: SnapshotAuditoria) => void {
  return (snapshot) => {
    if (snapshot.antes !== undefined || snapshot.extras !== undefined) {
      definirAuditBefore(req, snapshot.antes, snapshot.extras);
    }
    definirAuditEvento(req, snapshot.eventId);
    definirAuditEntidade(req, snapshot.entidadeId);
  };
}

const ENTITY_MAP: Record<string, string> = {
  orders: 'order',
  products: 'product',
  events: 'event',
  users: 'user',
  balances: 'balance',
  'cash-closure': 'cash-closure',
  kitchen: 'kitchen',
  reports: 'reports',
  audit: 'audit',
  auth: 'auth',
  public: 'public',
};

const SUFIXOS: Array<[string, string]> = [
  ['/export.csv', 'EXPORT'],
  ['/reverse', 'REVERSAL'],
  ['/reversal', 'REVERSAL'],
  ['/load', 'LOAD'],
  ['/deduct', 'DEDUCT'],
  ['/abrir', 'OPEN'],
  ['/fechar', 'CLOSE'],
  ['/cancel', 'CANCEL'],
  ['/status', 'STATUS'],
  ['/planta', 'PLANTA'],
  ['/members', 'MEMBER'],
  ['/settings', 'SETTINGS'],
  ['/extend', 'EXTEND'],
  ['/unarchive', 'UNARCHIVE'],
  ['/notified', 'NOTIFIED'],
  ['/upload', 'UPLOAD'],
  ['/transfer', 'TRANSFER'],
  ['/stock', 'STOCK_ADJUST'],
  ['/login', 'LOGIN'],
  ['/logout', 'LOGOUT'],
];

const ACOES_POR_METODO: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const metodo = (req.method || 'GET').toUpperCase();

    const caminhoAtual = this.caminho(req);
    const eExportacao = caminhoAtual.endsWith('/export.csv');
    if (['GET', 'HEAD', 'OPTIONS'].includes(metodo) && !eExportacao) {
      return next.handle();
    }

    const { acao, entity, entityId, eventId: eventIdBase } = this.descreverPedido(req, metodo);

    return next.handle().pipe(
      // Espera pela tentativa de persistência antes de devolver a resposta.
      // Antes era fire-and-forget (void record), o que podia perder logs no
      // encerramento do processo ou deixar a resposta à frente da auditoria.
      concatMap((data) => {
        const ator = this.resolverAtor(req, acao, data);
        const eventId = this.eventoEfetivo(req, eventIdBase, data, entity);
        return from(this.auditService.record({
          action: acao,
          entity,
          entityId: this.entidadeEfetiva(req, entityId, data),
          eventId,
          actorId: ator.id,
          actorRole: ator.role,
          before: this.resumoResposta((req as any)[AUDIT_BEFORE]),
          after: this.resumoResposta(data),
          details: this.sanitizarValor({
            method: metodo,
            url: this.caminho(req),
            statusCode: res.statusCode,
            params: req.params,
            ...this.detalhesExtras(req),
          }) as Record<string, unknown>,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })).pipe(map(() => data));
      }),
      catchError((error) => {
        const ator = this.resolverAtor(req, acao, undefined);
        const statusCode = (error as { status?: number })?.status ?? 500;
        const eventId = this.eventoEfetivo(req, eventIdBase);
        return from(this.auditService.record({
          action: metodo === 'POST' && acao === 'LOGIN' ? 'LOGIN_FAILED' : acao,
          entity,
          entityId: this.entidadeEfetiva(req, entityId),
          eventId: this.eventoEfetivo(req, eventIdBase),
          actorId: ator.id,
          actorRole: ator.role,
          details: this.sanitizarValor({
            method: metodo,
            url: this.caminho(req),
            statusCode,
            erro: (error as Error)?.name ?? 'Erro desconhecido',
            params: req.params,
            ...this.detalhesExtras(req),
          }) as Record<string, unknown>,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })).pipe(concatMap(() => throwError(() => error)));
      }),
    );
  }

  private caminho(req: Request): string {
    return (req.originalUrl || req.url || '').split('?')[0];
  }

  private detalhesExtras(req: Request): Record<string, unknown> {
    return ((req as any)[AUDIT_DETAILS_EXTRAS] as Record<string, unknown>) ?? {};
  }

  private eventoEfetivo(
    req: Request,
    base?: string,
    data?: any,
    entity?: string,
  ): string | undefined {
    const override = (req as any)[AUDIT_EVENT_ID] as string | undefined;
    if (override ?? base) {
      return override ?? base;
    }

    // Criações não têm eventId no path/body. O evento criado é o próprio id;
    // nos restantes recursos aproveitamos apenas relações explicitamente
    // devolvidas pela operação, nunca um id genérico.
    const candidato =
      entity === 'event'
        ? data?.id
        : data?.eventId ?? data?.event?.id ?? data?.order?.event?.id ?? data?.balance?.event?.id;
    return typeof candidato === 'string' && UUID_REGEX.test(candidato)
      ? candidato
      : undefined;
  }

  private entidadeEfetiva(req: Request, base?: string, data?: any): string | undefined {
    const override = (req as any)[AUDIT_ENTITY_ID] as string | undefined;
    if (override ?? base) {
      return override ?? base;
    }
    const candidato = data?.id ?? data?.order?.id ?? data?.balance?.id ?? data?.movement?.id;
    return typeof candidato === 'string' && UUID_REGEX.test(candidato)
      ? candidato
      : undefined;
  }

  private descreverPedido(
    req: Request,
    metodo: string,
  ): { acao: string; entity?: string; entityId?: string; eventId?: string } {
    const caminho = this.caminho(req);
    const segmentos = caminho.split('/').filter(Boolean);
    if (segmentos[0] === 'api') {
      segmentos.shift();
    }
    const entity = segmentos.length ? ENTITY_MAP[segmentos[0]] ?? segmentos[0] : undefined;

    let acao = ACOES_POR_METODO[metodo] ?? metodo;
    for (const [sufixo, valor] of SUFIXOS) {
      if (caminho.endsWith(sufixo)) {
        acao = valor;
        break;
      }
    }
    // /plantas/:plantaId termina num uuid, por isso o sufixo não apanha:
    // as mutações de planta (criar/renomear/apagar/gravar) ficam todas como
    // PLANTA, igual ao /planta legado.
    if (segmentos.includes('plantas')) {
      acao = 'PLANTA';
    } else if (segmentos.includes('members')) {
      acao = 'MEMBER';
    } else if (segmentos.includes('import')) {
      acao = 'IMPORT';
    } else if (segmentos.includes('duplicate')) {
      acao = 'DUPLICATE';
    }

    const entityId = segmentos.find((segmento) => UUID_REGEX.test(segmento));
    const eventParam = (req.params?.eventId as string) || (req.body?.eventId as string);
    const eventId = UUID_REGEX.test(eventParam || '')
      ? eventParam
      : entity === 'event'
        ? entityId
        : undefined;

    return { acao, entity, entityId, eventId };
  }

  private resolverAtor(
    req: Request,
    acao: string,
    data: any,
  ): { id?: string; role?: string } {
    const user = (req as any).user;
    if (user?.id) {
      return { id: user.id, role: user.role };
    }
    if (acao === 'LOGIN' && data?.user?.id) {
      return { id: data.user.id, role: data.user.role };
    }
    return {};
  }

  /**
   * A auditoria nunca deve persistir credenciais, mesmo quando um endpoint
   * devolve tokens no corpo (login/refresh) ou quando um snapshot inclui uma
   * entidade com campos sensíveis. A sanitização é recursiva e não muta o
   * objecto original devolvido ao cliente.
   */
  private sanitizarValor(valor: unknown, profundidade = 0, vistos = new WeakSet<object>()): unknown {
    if (valor === null || valor === undefined) return valor;
    if (typeof valor === 'bigint') return valor.toString();
    if (typeof valor !== 'object') {
      if (typeof valor === 'string') {
        return valor
          .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT REDACTED]')
          .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
      }
      return valor;
    }
    if (valor instanceof Date) return valor.toISOString();
    if (profundidade >= 12) return '[profundidade limitada]';
    if (vistos.has(valor)) return '[referência circular]';
    vistos.add(valor);

    if (Array.isArray(valor)) {
      return valor.map((item) => this.sanitizarValor(item, profundidade + 1, vistos));
    }

    const resultado: Record<string, unknown> = {};
    const camposSensíveis = /(password|passwd|pwd|token|secret|authorization|cookie|api[_-]?key|private[_-]?key|credential|access[_-]?code|verification[_-]?code|one[_-]?time[_-]?code|code[_-]?verifier|otp|pin)/i;
    for (const [chave, conteudo] of Object.entries(valor)) {
      resultado[chave] = camposSensíveis.test(chave)
        ? '[REDACTED]'
        : this.sanitizarValor(conteudo, profundidade + 1, vistos);
    }
    return resultado;
  }

  private resumoResposta(data: any): unknown {
    if (data === undefined || data === null) {
      return undefined;
    }
    try {
      const seguro = this.sanitizarValor(data);
      const texto = JSON.stringify(seguro);
      if (texto.length > 8000) {
        return {
          resumo: 'resposta extensa',
          total: data?.total,
          items: Array.isArray(data?.items) ? data.items.length : undefined,
        };
      }
      return seguro;
    } catch {
      return undefined;
    }
  }
}

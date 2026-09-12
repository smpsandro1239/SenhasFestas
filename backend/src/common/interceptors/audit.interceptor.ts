import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../../modules/audit/audit.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  ['/abrir', 'OPEN'],
  ['/fechar', 'CLOSE'],
  ['/cancel', 'CANCEL'],
  ['/status', 'STATUS'],
  ['/members', 'MEMBER'],
  ['/settings', 'SETTINGS'],
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

    const { acao, entity, entityId, eventId } = this.descreverPedido(req, metodo);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const ator = this.resolverAtor(req, acao, data);
          void this.auditService.record({
            action: acao,
            entity,
            entityId,
            eventId,
            actorId: ator.id,
            actorRole: ator.role,
            after: this.resumoResposta(data),
            details: {
              method: metodo,
              url: this.caminho(req),
              statusCode: res.statusCode,
              params: req.params,
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        },
        error: (error) => {
          const ator = this.resolverAtor(req, acao, undefined);
          const statusCode = (error as { status?: number })?.status ?? 500;
          void this.auditService.record({
            action: metodo === 'POST' && acao === 'LOGIN' ? 'LOGIN_FAILED' : acao,
            entity,
            entityId,
            eventId,
            actorId: ator.id,
            actorRole: ator.role,
            details: {
              method: metodo,
              url: this.caminho(req),
              statusCode,
              erro: (error as Error)?.message,
              params: req.params,
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        },
      }),
    );
  }

  private caminho(req: Request): string {
    return (req.originalUrl || req.url || '').split('?')[0];
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

  private resumoResposta(data: any): unknown {
    if (data === undefined || data === null) {
      return undefined;
    }
    try {
      const texto = JSON.stringify(data);
      if (texto.length > 8000) {
        return { resumo: 'resposta extensa', total: data?.total, items: Array.isArray(data?.items) ? data.items.length : undefined };
      }
      return data;
    } catch {
      return undefined;
    }
  }
}

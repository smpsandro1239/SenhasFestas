import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const VERCEL_APP_RE = /^(?:[\w-]+\.)+vercel\.app$/;

function normalizarOrigem(valor: string): string {
  return valor
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/:\d+$/, '');
}

export function hostConfiavel(host: string | undefined, confiaveis: Set<string>): boolean {
  if (!host) {
    return false;
  }
  const normalizado = normalizarOrigem(host);
  const listaNormalizada = new Set([...confiaveis].map(normalizarOrigem));
  if (listaNormalizada.has(normalizado)) {
    return true;
  }
  return normalizado === 'localhost' || VERCEL_APP_RE.test(normalizado);
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const method = req.method;
    const temCookie = Boolean(req.headers.cookie);
    const temBearer = (req.headers.authorization || '').startsWith('Bearer ');

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && temCookie && !temBearer) {
      const origin = req.headers.origin;
      if (!origin) {
        res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Origem obrigatória para pedidos autenticados por cookie',
        });
        return;
      }
      const permitidas = (process.env.FRONTEND_URL || 'http://localhost:3001')
        .split(',')
        .map((o) => {
          try {
            return new URL(o.trim()).origin;
          } catch {
            return '';
          }
        })
        .filter(Boolean);
      let origemNormalizada = '';
      try {
        origemNormalizada = new URL(origin).origin;
      } catch {
        origemNormalizada = '';
      }
      // Não confiar em X-Forwarded-Host/Proto enviados pelo próprio cliente
      // para validar CSRF. A origem permitida vem apenas da configuração.
      if (!origemNormalizada || !permitidas.includes(origemNormalizada)) {
        res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Origem não permitida',
        });
        return;
      }
    }

    next();
  }
}
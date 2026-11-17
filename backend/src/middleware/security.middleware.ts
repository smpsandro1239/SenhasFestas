import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const VERCEL_APP_RE = /^(?:[\w-]+\.)+vercel\.app$/;

function normalizarOrigem(valor: string): string {
  try {
    const entrada = valor.includes('://') ? valor : `https://${valor}`;
    // Preservar a porta evita aceitar Host:dominio-confiavel:porta-arbitraria
    // e redireccionar o cliente para outro serviço no mesmo hostname.
    return new URL(entrada).host.toLowerCase();
  } catch {
    return '';
  }
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
  return normalizado === 'localhost';
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
        origemNormalizada = origin ? new URL(origin).origin : '';
      } catch {
        origemNormalizada = '';
      }

      // Origin é obrigatório e comparado apenas com origens configuradas.
      // Não confiar em Host/X-Forwarded-* fornecidos pelo pedido para CSRF.
      if (!origemNormalizada) {
        res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Origem obrigatória',
        });
        return;
      }
      if (!permitidas.includes(origemNormalizada)) {
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
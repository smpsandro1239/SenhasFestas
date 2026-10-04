import { Injectable, ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

// Postgres unica violation. Os outros codigos ficam de fora de proposito:
// 23503 (foreign key) e 23502 (not null) sao falhas de integridade do
// codigo, nao input invalido, e tem de continuar a chegar ao log de erro.
const CODIGO_UNIQUE_VIOLATION = '23505';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.classificar(exception);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - Status: ${status} - Erro: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - Status: ${status} - Mensagem: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private classificar(exception: unknown): { status: number; message: unknown } {
    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), message: exception.getResponse() };
    }

    // Rede de seguranca para as constraints unicas, nao o mecanismo principal:
    // o registo e a criacao de utilizador ja fazem findOne antes de gravar e
    // devolvem 409. O que um findOne nao faz e fechar a janela — duas
    // inscricoes concorrentes com o mesmo email passam as duas pelo findOne, a
    // perdedora leva com um 23505, e sem este ramo isso chegava ao utilizador
    // como 500 e ao log de erro.
    //
    // A mensagem e generica de proposito. O driverError traz a constraint e o
    // detail, que dizem exatamente qual coluna colide; devolver isso seria
    // enumeracao de esquema.
    if (exception instanceof QueryFailedError) {
      const codigo = (exception.driverError as { code?: string } | undefined)?.code;
      if (codigo === CODIGO_UNIQUE_VIOLATION) {
        return { status: HttpStatus.CONFLICT, message: 'Registo já existe' };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
    };
  }
}
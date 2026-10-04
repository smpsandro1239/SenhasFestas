import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryFailedError } from 'typeorm';
import {
  HttpStatus,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// Um 23505 e o unico codigo Postgres que significa "a tua input colide com
// algo que ja existe". E um erro do cliente que chega como 500 porque o
// QueryFailedError nao e um HttpException e o filter so conhece HttpException.
//
// Isto importa como rede de seguranca, nao como mecanismo principal: o
// registo e a criacao de utilizador ja fazem findOne antes de gravar e
// devolvem 409. O que essas verificacoes nao fazem e fechar a janela — duas
// inscricoes concorrentes com o mesmo email passam as duas pelo findOne e a
// perdedora leva com um 23505 em vez de 409. E o unico sitio onde esse 500
// chega ao utilizador.

function criarHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/auth/register', method: 'POST' }),
    }),
  } as any;
  return { host, status, json };
}

const erroUnique = (constraint?: string) =>
  new QueryFailedError(
    'INSERT INTO "users" ...',
    [],
    {
      code: '23505',
      constraint,
      detail: constraint
        ? `Key (${constraint.slice(constraint.indexOf('=') + 1)})=(x) already exists.`
        : 'Key (email)=(x@y.z) already exists.',
    },
  );

describe('AllExceptionsFilter — violacao de unicidade', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('mapeia 23505 para 409, e nao 500', () => {
    const { host, status } = criarHost();
    filter.catch(erroUnique('UQ_users_email'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('a mensagem e generica e nao revela a coluna duplicada', () => {
    const { host, json } = criarHost();
    filter.catch(erroUnique('UQ_users_email'), host);
    const corpo = json.mock.calls[0][0];
    expect(corpo.message).toBe('Registo já existe');
    // A constraint e o detalhe do Postgres dizem qual coluna colide. Passar
    // isso para o cliente seria enumeracao de esquema.
    expect(JSON.stringify(corpo)).not.toContain('UQ_users_email');
    expect(JSON.stringify(corpo)).not.toContain('already exists');
  });

  it('o corpo mantem a forma que o resto da API ja usa', () => {
    const { host, json } = criarHost();
    filter.catch(erroUnique(), host);
    expect(Object.keys(json.mock.calls[0][0]).sort()).toEqual(
      ['message', 'method', 'path', 'statusCode', 'timestamp'].sort(),
    );
  });

  it('serve para qualquer constraint unica, nao so email', () => {
    // access_code tambem e unique e nao tem verificacao previa em lado nenhum.
    const { host, status } = criarHost();
    filter.catch(erroUnique('UQ_users_access_code'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });
});

describe('AllExceptionsFilter — 23505 e so o 23505', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  const queryFailed = (code: string) =>
    new QueryFailedError('INSERT ...', [], { code });

  it('23503 (violacao de foreign key) continua a ser 500', () => {
    // Uma FK violada e bug de integridade, nao input invalido. Deve subir para
    // o log de erro, onde se ve, e nao virar um 409 que esconde a causa.
    const { host, status } = criarHost();
    filter.catch(queryFailed('23503'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('23502 (not-null violada) continua a ser 500', () => {
    const { host, status } = criarHost();
    filter.catch(queryFailed('23502'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('23514 (check violada) continua a ser 500', () => {
    const { host, status } = criarHost();
    filter.catch(queryFailed('23514'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('um QueryFailedError sem driverError.code nao rebenta o filter', () => {
    // O construtor do TypeORM chama driverError.toString() sem guarda, por isso
    // um driverError totalmente ausente rebenta na construcao. O caso que
    // interessa e um driverError sem 'code'.
    const { host, status } = criarHost();
    const semCodigo = new QueryFailedError('INSERT ...', [], { message: 'sem code' });
    expect(() => filter.catch(semCodigo, host)).not.toThrow();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe('AllExceptionsFilter — comportamento existente preservado', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('HttpException continua a passar com o seu proprio status', () => {
    for (const [excecao, esperado] of [
      [new NotFoundException('Não encontrado'), HttpStatus.NOT_FOUND],
      [new BadRequestException('Má'), HttpStatus.BAD_REQUEST],
      [new ConflictException('Já existe'), HttpStatus.CONFLICT],
    ] as const) {
      const { host, status } = criarHost();
      filter.catch(excecao, host);
      expect(status).toHaveBeenCalledWith(esperado);
    }
  });

  it('um erro desconhecido continua a ser 500 com mensagem generica', () => {
    const { host, status, json } = criarHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0].message).toBe('Erro interno do servidor');
  });

  it('o ConflictException do codigo de acesso continua a passar por cima', () => {
    // access-code.ts atira ConflictException directamente. O ramo novo do
    // filter nao pode engolir isso nem mudar a mensagem.
    const { host, json } = criarHost();
    filter.catch(new ConflictException('Não foi possível gerar um código'), host);
    expect(json.mock.calls[0][0].message).toBe('Não foi possível gerar um código');
  });
});
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carregarAmbienteE2e, configuracaoBaseDadosE2e } from './e2e-database-safety';

const optIn = { E2E_ALLOW_SCHEMA_RESET: 'true' };

describe('configuracaoBaseDadosE2e — barreira contra BD remota', () => {
  it('aceita apenas BD local dedicada com opt-in explícito', () => {
    expect(
      configuracaoBaseDadosE2e({
        ...optIn,
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_NAME: 'senhasfestas_test',
        DB_SSL: 'false',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 5433,
      user: 'postgres',
      password: 'postgres',
      database: 'senhasfestas_test',
      ssl: undefined,
    });
  });

  it('detecta DATABASE_URL remota em .env.development antes do bootstrap Nest', () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'senhasfestas-e2e-env-'));
    try {
      writeFileSync(
        join(diretorio, '.env.development'),
        'DATABASE_URL=postgresql://user:pass@ep-remote.eu.neon.tech/senhasfestas_test?sslmode=require\n',
      );
      writeFileSync(
        join(diretorio, '.env'),
        'DATABASE_URL=postgresql://user:pass@localhost/senhasfestas_test\n',
      );

      const ambiente = carregarAmbienteE2e(diretorio, {});
      expect(ambiente.DATABASE_URL).toContain('ep-remote.eu.neon.tech');
      expect(() =>
        configuracaoBaseDadosE2e({ ...ambiente, E2E_ALLOW_SCHEMA_RESET: 'true' }),
      ).toThrow(/não é local/);
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('variáveis exportadas no processo prevalecem sobre os ficheiros .env', () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'senhasfestas-e2e-env-'));
    try {
      writeFileSync(
        join(diretorio, '.env.development'),
        'DATABASE_URL=postgresql://user:pass@ep-remote.eu.neon.tech/senhasfestas_test\n',
      );
      const ambiente = carregarAmbienteE2e(diretorio, {
        DATABASE_URL: 'postgresql://user:pass@localhost/senhasfestas_test',
        E2E_ALLOW_SCHEMA_RESET: 'true',
      });
      expect(ambiente.DATABASE_URL).toContain('@localhost');
      expect(configuracaoBaseDadosE2e(ambiente).database).toBe('senhasfestas_test');
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('rejeita Neon e qualquer outro host remoto antes de abrir ligação', () => {
    expect(() =>
      configuracaoBaseDadosE2e({
        ...optIn,
        DATABASE_URL: 'postgresql://user:pass@ep-example.eu.neon.tech/senhasfestas_test?sslmode=require',
      }),
    ).toThrow(/não é local/);
  });

  it('rejeita base de dados local sem sufixo descartável', () => {
    expect(() =>
      configuracaoBaseDadosE2e({
        ...optIn,
        DB_HOST: 'localhost',
        DB_NAME: 'senhasfestas',
      }),
    ).toThrow(/não termina em _test ou _e2e/);
  });

  it('exige autorização explícita para testes que podem apagar o schema', () => {
    expect(() =>
      configuracaoBaseDadosE2e({
        DB_HOST: 'localhost',
        DB_NAME: 'senhasfestas_test',
      }),
    ).toThrow(/E2E_ALLOW_SCHEMA_RESET=true/);
  });

  it('respeita DB_SSL=true mesmo quando usa variáveis DB_*', () => {
    const config = configuracaoBaseDadosE2e({
      ...optIn,
      DB_HOST: 'localhost',
      DB_NAME: 'senhasfestas_e2e',
      DB_SSL: 'true',
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('preserva a configuração SSL de DATABASE_URL', () => {
    const config = configuracaoBaseDadosE2e({
      ...optIn,
      DATABASE_URL: 'postgresql://user:pass@localhost/senhasfestas_test?sslmode=require',
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });
});

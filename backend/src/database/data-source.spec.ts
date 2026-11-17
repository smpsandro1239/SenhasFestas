import { describe, expect, it } from 'vitest';
import { configuracaoDataSource } from './data-source';

describe('configuracaoDataSource', () => {
  it('usa DATABASE_URL e valida TLS com sslmode', () => {
    const config = configuracaoDataSource({
      DATABASE_URL: 'postgresql://user%40example.test:p%40ss@db.example.test:6543/senhasfestas?sslmode=verify-full',
      DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----',
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      type: 'postgres',
      host: 'db.example.test',
      port: 6543,
      username: 'user@example.test',
      password: 'p@ss',
      database: 'senhasfestas',
      ssl: {
        rejectUnauthorized: true,
        ca: '-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----',
      },
    });
  });

  it('aplica TLS estrito ao usar DB_SSL sem DATABASE_URL', () => {
    const config = configuracaoDataSource({
      DB_HOST: 'postgres.internal',
      DB_PORT: '5433',
      DB_USERNAME: 'senhasfestas',
      DB_PASSWORD: 'secret',
      DB_NAME: 'senhasfestas_test',
      DB_SSL: 'true',
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      host: 'postgres.internal',
      port: 5433,
      username: 'senhasfestas',
      password: 'secret',
      database: 'senhasfestas_test',
      ssl: { rejectUnauthorized: true },
    });
  });

  it('não ativa TLS quando sslmode=disable e DB_SSL não está ativo', () => {
    const config = configuracaoDataSource({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/senhasfestas_test?sslmode=disable',
    } as NodeJS.ProcessEnv);

    expect(config).toHaveProperty('ssl', undefined);
  });

  it('mantém configuração local sem TLS por omissão', () => {
    const config = configuracaoDataSource({} as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'senhasfestas',
    });
    expect(config).toHaveProperty('ssl', undefined);
  });
});

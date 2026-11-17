import { describe, expect, it, vi } from 'vitest';
import { configuracaoBaseDados } from './app.setup';

function config(valores: Record<string, string>) {
  return {
    get: vi.fn((chave: string) => valores[chave]),
  } as any;
}

describe('configuracaoBaseDados — TLS PostgreSQL', () => {
  it('valida o certificado quando DB_SSL está ativo', () => {
    const resultado = configuracaoBaseDados(config({
      DB_SSL: 'true',
      DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nCA\\n-----END CERTIFICATE-----',
    }));

    expect(resultado.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\\nCA\\n-----END CERTIFICATE-----',
    });
  });

  it('não ativa TLS quando DB_SSL está desativado', () => {
    const resultado = configuracaoBaseDados(config({ DB_SSL: 'false' }));
    expect(resultado.ssl).toBeUndefined();
  });

  it('ativa TLS validado para DATABASE_URL com sslmode=require', () => {
    const resultado = configuracaoBaseDados(config({
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    }));

    expect(resultado.ssl).toEqual({ rejectUnauthorized: true });
  });
});

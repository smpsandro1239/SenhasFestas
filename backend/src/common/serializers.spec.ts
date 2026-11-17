import { describe, expect, it } from 'vitest';
import { snapshot } from './serializers';

describe('snapshot — minimização de dados em logs de auditoria', () => {
  it('remove mensagens de erro e stack traces de detalhes de auditoria', () => {
    const resultado = snapshot({
      operacao: 'fechar-caixa',
      erro: 'password=secreto email=privado@example.com',
      error: 'database connection string',
      stack: 'Error: secret\\n at internal/path',
    }) as Record<string, unknown>;

    expect(resultado).toEqual({ operacao: 'fechar-caixa' });
  });

  it('remove credenciais e dados pessoais independentemente da capitalização', () => {
    const resultado = snapshot({
      id: 'u1',
      email: 'privado@example.com',
      Phone: '+351900000000',
      accessCode: '123456',
      refreshToken: 'refresh-secret',
      tokenHash: 'hash-secret',
      Authorization: 'Bearer secret',
      cookie: 'sf_token=secret',
      total: 12.5,
    }) as Record<string, unknown>;

    expect(resultado).toEqual({ id: 'u1', total: 12.5 });
  });
});

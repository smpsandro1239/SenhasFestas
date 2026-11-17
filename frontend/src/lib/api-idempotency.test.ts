import { describe, expect, it } from 'vitest';
import { ApiError, isDefinitiveIdempotencyError } from './api';

describe('isDefinitiveIdempotencyError', () => {
  it.each([400, 401, 403, 404, 409, 422])('considera %i um erro definitivo', (status) => {
    expect(isDefinitiveIdempotencyError(new ApiError('erro', status))).toBe(true);
  });

  it.each([408, 425, 429, 500, 502, 503, 504])('preserva a chave perante resposta %i', (status) => {
    expect(isDefinitiveIdempotencyError(new ApiError('erro', status))).toBe(false);
  });

  it('trata falhas de rede como ambíguas', () => {
    expect(isDefinitiveIdempotencyError(new TypeError('Failed to fetch'))).toBe(false);
  });
});

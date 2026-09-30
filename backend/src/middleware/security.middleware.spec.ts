import { describe, it, expect } from 'vitest';
import { hostConfiavel } from './security.middleware';

describe('hostConfiavel (A6: open redirect via Host header)', () => {
  const confiaveis = new Set([
    'https://senhas-festas.vercel.app',
    'http://localhost:3001',
  ]);

  it('recusa um Host arbitrário (evil.com)', () => {
    expect(hostConfiavel('evil.com', confiaveis)).toBe(false);
  });

  it('recusa Host com domínio semelhante (senhas-festas.vercel.app.evil.com)', () => {
    expect(hostConfiavel('senhas-festas.vercel.app.evil.com', confiaveis)).toBe(false);
  });

  it('aceita o FRONTEND_URL confiável', () => {
    expect(hostConfiavel('senhas-festas.vercel.app', confiaveis)).toBe(true);
  });

  it('aceita localhost para desenvolvimento', () => {
    expect(hostConfiavel('localhost:3001', confiaveis)).toBe(true);
  });

  it('aceita previews *.vercel.app (fluxo de desenvolvimento não parte)', () => {
    expect(hostConfiavel('senhasfestas-api-abc123-user.vercel.app', confiaveis)).toBe(true);
  });

  it('recusa host em falta', () => {
    expect(hostConfiavel('', confiaveis)).toBe(false);
    expect(hostConfiavel(undefined as unknown as string, confiaveis)).toBe(false);
  });
});
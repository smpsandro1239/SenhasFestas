import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import * as registry from './index';

describe('registry estática de migrations', () => {
  it('exporta exatamente uma classe por ficheiro de migration da pasta', () => {
    const ficheiros = readdirSync(__dirname).filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.spec.ts'),
    );
    const classes = Object.values(registry).filter((v) => typeof v === 'function');

    const nomes = classes.map((c) => c.name);
    for (const ficheiro of ficheiros) {
      const m = ficheiro.match(/^(\d+)-(.+)\.ts$/);
      expect(m, `nome de ficheiro inválido: ${ficheiro}`).toBeTruthy();
      if (!m) continue;
      expect(nomes, `ficheiro sem export em index.ts: ${ficheiro}`).toContain(m[2] + m[1]);
    }
    expect(classes.length).toBe(ficheiros.length);
  });
});

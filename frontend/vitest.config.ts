import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // O vitest nao le o `paths` do tsconfig, e o codigo usa `@/lib/cn` etc.
  // Alias manual em vez do plugin vite-tsconfig-paths: e uma linha e nao
  // acrescenta dependencia.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // O tsconfig tem "jsx": "preserve" (padrao do Next), que o transform nao
  // converte. Vite 7 transforma TS/TSX com oxc, nao esbuild — por isso a opcao
  // e `oxc` e nao `esbuild` (esta e silenciosamente ignorada).
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    // 'node' por omissao e deliberado: middleware.test.ts assina JWT com o
    // `jose`, e em jsdom o Uint8Array e de outro realm e a verificacao de tipo
    // da CryptoKey rebenta ("must be one of type CryptoKey... Received an
    // instance of Uint8Array"). Os testes de componente pedem jsdom por
    // ficheiro, com // @vitest-environment jsdom no topo.
    environment: 'node',
  },
});
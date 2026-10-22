import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Os ficheiros e2e partilham a mesma base de dados: `app.e2e-spec.ts`
    // faz `DROP SCHEMA public CASCADE` + `runMigrations()`. Em paralelo, um
    // ficheiro apaga o schema enquanto o outro ainda está a inicializar.
    fileParallelism: false,
  },
});

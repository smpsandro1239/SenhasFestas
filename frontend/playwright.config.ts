import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error(
    'E2E_BASE_URL é obrigatória. A suite não corre contra produção por omissão. ' +
      'Ex.: $env:E2E_BASE_URL="http://localhost:3000"; npx playwright test',
  );
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    headless: !process.env.E2E_HEADED,
    channel: process.env.E2E_CHANNEL || 'msedge',
  },
});
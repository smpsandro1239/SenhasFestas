import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://senhas-festas-ten.vercel.app',
    viewport: { width: 1440, height: 900 },
    headless: !process.env.E2E_HEADED,
    channel: process.env.E2E_CHANNEL || 'msedge',
  },
});
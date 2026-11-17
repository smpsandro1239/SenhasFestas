import { test, expect } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

test.describe('Design system — autenticação responsiva', () => {
  for (const viewport of viewports) {
    test(`login sem overflow horizontal em ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/auth/login', { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { name: 'SenhasFestas' })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Palavra-passe')).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.document,
        `overflow horizontal: documento=${dimensions.document}px, viewport=${dimensions.viewport}px`,
      ).toBeLessThanOrEqual(dimensions.viewport + 1);
    });
  }

  test('campos e ação principal cumprem dimensões operacionais mínimas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth/login', { waitUntil: 'networkidle' });

    const email = page.getByLabel('Email');
    const password = page.getByLabel('Palavra-passe');
    const submit = page.getByRole('button', { name: 'Entrar' });

    expect((await email.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await password.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  });

  test('respeita a preferência de movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/auth/login', { waitUntil: 'networkidle' });

    const duration = await page.getByRole('button', { name: 'Entrar' }).evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration),
    );
    expect(duration).toBeLessThanOrEqual(0.001);
  });
});

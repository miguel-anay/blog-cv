import { test, expect } from '@playwright/test';

const PAGES = ['/', '/blog', '/about', '/cv', '/courses'];

test.describe('responsive layout — no horizontal overflow', () => {
  for (const path of PAGES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe('mobile nav', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('hamburger button is visible on mobile', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-mobile-nav-toggle]');
    await expect(toggle).toBeVisible();
  });

  test('drawer opens and shows nav links', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-mobile-nav-toggle]');
    await toggle.click();
    const drawer = page.locator('[data-mobile-nav]');
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('link', { name: /blog/i }).first()).toBeVisible();
  });

  test('drawer closes with ESC', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-mobile-nav-toggle]');
    await toggle.click();
    await page.keyboard.press('Escape');
    const drawer = page.locator('[data-mobile-nav]');
    await expect(drawer).toBeHidden();
  });

  test('desktop nav is hidden on mobile', async ({ page }) => {
    await page.goto('/');
    const desktopNav = page.locator('.site-nav');
    await expect(desktopNav).toBeHidden();
  });
});

test.describe('desktop nav', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('site-nav is visible on desktop', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.site-nav');
    await expect(nav).toBeVisible();
  });

  test('hamburger button is hidden on desktop', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-mobile-nav-toggle]');
    await expect(toggle).toBeHidden();
  });
});

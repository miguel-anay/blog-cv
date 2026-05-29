import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = 'test-results/screenshots';

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.describe('Matrix intro — canvas 2D', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.removeItem('mx-intro-done'));
  });

  test('overlay renders on home page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#matrix-intro')).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}_matrix-overlay.png`),
    });
  });

  test('canvas has real dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const box = await page.locator('#matrix-canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('types "Rubber duck debugging" in the center', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const text = page.locator('#matrix-text');
    await expect(text).toBeVisible({ timeout: 5000 });

    // Full text typed at ~80ms/char — 21 chars = ~1680ms
    await expect(text).toHaveText('Rubber duck debugging', { timeout: 3000 });
  });

  test('auto-dismisses after 5 seconds and sets sessionStorage', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#matrix-intro')).toBeVisible({ timeout: 5000 });

    // 5s timer + 1s fade
    await expect(page.locator('#matrix-intro')).not.toBeAttached({ timeout: 7000 });

    const key = await page.evaluate(() => sessionStorage.getItem('mx-intro-done'));
    expect(key).toBe('1');

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}_matrix-dismissed.png`),
    });
  });

  test('hero is visible after intro disappears', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#matrix-intro')).not.toBeAttached({ timeout: 7000 });
    await expect(page.locator('.hero')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Matrix intro — sessionStorage', () => {
  test('does not re-show after first visit', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#matrix-intro')).toBeVisible({ timeout: 5000 });

    // Wait for it to dismiss and set sessionStorage
    await expect(page.locator('#matrix-intro')).not.toBeAttached({ timeout: 7000 });

    // Second visit — intro must NOT appear
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#matrix-intro')).not.toBeAttached({ timeout: 3000 });

    await ctx.close();
  });
});

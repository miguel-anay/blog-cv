import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = 'test-results/screenshots';

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.describe('Matrix intro — trinity effect', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      sessionStorage.removeItem('mx-intro-done');
    });
  });

  test('overlay renders on home page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const intro = page.locator('#matrix-intro');
    await expect(intro).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}_matrix-overlay.png`),
    });
  });

  test('iframe points to trinity version', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const iframe = page.locator('#matrix-intro iframe');
    await expect(iframe).toBeVisible({ timeout: 5000 });

    const src = await iframe.getAttribute('src');
    expect(src).toContain('version=trinity');
    expect(src).toContain('suppressWarnings=true');
  });

  test('WebGL canvas created inside iframe', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const matrixFrame = page.frameLocator('#matrix-intro iframe');
    const canvas = matrixFrame.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 12000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}_matrix-trinity-canvas.png`),
    });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('[ ENTER ] button dismisses intro', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const intro = page.locator('#matrix-intro');
    await expect(intro).toBeVisible({ timeout: 5000 });

    await page.click('#matrix-enter');

    await expect(intro).not.toBeAttached({ timeout: 5000 });
    await expect(page.locator('.hero')).toBeVisible({ timeout: 3000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}_matrix-dismissed.png`),
    });
  });

});

// Separate describe — uses a fresh browser context (no addInitScript) so sessionStorage
// persists naturally across navigations within the same session
test.describe('Matrix intro — sessionStorage', () => {
  test('does not re-show after dismiss', async ({ browser }) => {
    // Fresh context: no addInitScript, clean sessionStorage
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // First visit — intro should appear
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const intro = page.locator('#matrix-intro');
    await expect(intro).toBeVisible({ timeout: 5000 });

    await page.click('#matrix-enter');
    await expect(intro).not.toBeAttached({ timeout: 5000 });

    // sessionStorage key must be set
    const key = await page.evaluate(() => sessionStorage.getItem('mx-intro-done'));
    expect(key).toBe('1');

    // Second visit in same session — intro must NOT appear
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#matrix-intro')).not.toBeAttached({ timeout: 5000 });

    await ctx.close();
  });
});

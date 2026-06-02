import { test, expect } from '@playwright/test';

test.describe('courses-card-flow — page load', () => {
  test('/courses loads without error', async ({ page }) => {
    const response = await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    expect(response?.status()).toBeLessThan(500);
  });

  test('/courses has no horizontal overflow', async ({ page, viewport }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, `/courses overflows by ${scrollWidth - clientWidth}px`).toBeLessThanOrEqual(clientWidth);
  });

  test('/courses renders courses-inner container', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.courses-inner')).toBeVisible();
  });
});

test.describe('courses-card-flow — sections page', () => {
  test('/courses/unknown-slug/sections returns 404', async ({ page }) => {
    const response = await page.goto('/courses/this-slug-does-not-exist-xyz/sections');
    expect(response?.status()).toBe(404);
  });
});

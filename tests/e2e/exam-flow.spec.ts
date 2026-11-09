import { test, expect } from '@playwright/test';

test.describe('exam-flow — page load', () => {
  test('/exams loads without error', async ({ page }) => {
    const response = await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    expect(response?.status()).toBeLessThan(500);
  });

  test('/exams has no horizontal overflow', async ({ page, viewport }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, `/exams overflows by ${scrollWidth - clientWidth}px`).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe('exam-flow — detail page', () => {
  // No login since #32: an unknown slug reaches the page's own 404.
  test('/exams/some-unknown-slug returns 404', async ({ page }) => {
    const response = await page.goto('/exams/some-unknown-slug');
    expect(response?.status()).toBe(404);
  });
});

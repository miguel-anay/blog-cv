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
  // /exams is behind the auth middleware (protectedPagePrefixes includes
  // '/exams'), so an unauthenticated request to ANY /exams/* path — known
  // slug or not — 302-redirects to /login before the page's own
  // slug-not-found 404 logic ever runs. Asserting a literal 404 here without
  // a seeded auth session would be a false precondition (see report: the
  // equivalent courses precedent test already fails the same way today).
  // This instead confirms the route is gated correctly and never 5xxs.
  test('/exams/some-unknown-slug redirects to login (protected route)', async ({ page }) => {
    const response = await page.goto('/exams/some-unknown-slug');
    await page.waitForLoadState('networkidle');
    expect(response?.status()).toBeLessThan(500);
    expect(page.url()).toContain('/login');
  });
});

import { test, expect } from '@playwright/test';

const PAGES = ['/', '/blog', '/about', '/cv', '/courses'];

test.describe('visual check — horizontal overflow', () => {
  for (const path of PAGES) {
    test(`no overflow: ${path}`, async ({ page, viewport }, testInfo) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      // Screenshot for visual inspection
      await page.screenshot({
        path: `test-results/screenshots/${testInfo.project.name}${path.replace(/\//g, '_') || '_home'}.png`,
        fullPage: false,
      });

      if (scrollWidth > clientWidth) {
        // Take extra screenshot showing the overflow area
        await page.setViewportSize({ width: scrollWidth, height: viewport!.height });
        await page.screenshot({
          path: `test-results/screenshots/${testInfo.project.name}${path.replace(/\//g, '_') || '_home'}_overflow.png`,
          fullPage: false,
        });
      }

      expect(scrollWidth, `${path} overflows by ${scrollWidth - clientWidth}px`).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe('visual check — mobile nav', () => {
  test('hamburger visible, desktop nav hidden', async ({ page, viewport, isMobile }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isMobileView = viewport!.width < 768;

    const toggle = page.locator('[data-mobile-nav-toggle]');
    const desktopNav = page.locator('.site-nav');

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.project.name}_nav_closed.png`,
    });

    if (isMobileView) {
      await expect(toggle).toBeVisible();
      await expect(desktopNav).toBeHidden();

      // Open drawer and screenshot
      await toggle.click();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `test-results/screenshots/${testInfo.project.name}_nav_open.png`,
      });

      const drawer = page.locator('[data-mobile-nav]');
      await expect(drawer).toBeVisible();
    } else {
      await expect(desktopNav).toBeVisible();
      await expect(toggle).toBeHidden();
    }
  });
});

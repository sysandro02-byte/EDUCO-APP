import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('loads the cached application shell without a network connection', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);

  // A reload is required for a newly installed worker to control this tab.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveTitle(/EDUCO/i);
  await expect(page.locator('#root')).not.toBeEmpty();
});

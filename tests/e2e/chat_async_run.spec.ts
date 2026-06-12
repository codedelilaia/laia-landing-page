import { expect, test } from '@playwright/test';

test('chat submit queues immediately and rehydrates pending work after refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await page.locator('textarea').fill('Check async persistence');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Working…')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Chat' }).click();
  await expect(page.locator('.chat-bubble--assistant').last()).toContainText(/Working…|Still working…|Completed\.|Smoke test async reply\./);
});

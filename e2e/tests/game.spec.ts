import { expect, test } from '@playwright/test';
import { addBot, createRoom, loginAsGuest, playerListSection, unique } from './helpers';

test.describe('开始游戏', () => {
  test('房主与电脑可以开始达芬奇密码', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'));

    // Add one bot so we have 2 players (达芬奇密码 needs 2-4).
    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    // Default queue is [谁是卧底, 达芬奇密码]; move 达芬奇密码 to the front so it
    // is the next game (谁是卧底 would auto-spectate bots and need 4 humans).
    const queueSection = page.locator('section.card', { hasText: '游戏队列' });
    // Two "↑" buttons exist; index 1 (达芬奇密码) is the enabled one.
    await queueSection.getByRole('button', { name: '↑' }).nth(1).click();
    await queueSection.getByRole('button', { name: '保存队列' }).click();

    // Retry the start click: it can race the queue-save persisting server-side.
    await expect(async () => {
      await page.getByRole('button', { name: '开始下一局' }).click();
      await expect(page.getByRole('heading', { name: '达芬奇密码' })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });
});

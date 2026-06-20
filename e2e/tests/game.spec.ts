import { expect, test } from '@playwright/test';
import { addBot, createRoom, loginAsGuest, playerListSection, unique } from './helpers';

test.describe('开始游戏', () => {
  test('房主与电脑可以开始德国心脏病', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'german_heart_attack');

    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('德国心脏病', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('房主与电脑可以开始达芬奇密码', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'da_vinci_code');

    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('达芬奇密码', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('房主与电脑可以开始狼人杀', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'werewolf');

    for (let i = 0; i < 5; i++) {
      await addBot(page);
    }
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(5);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('狼人杀', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('房主与电脑可以开始中国象棋', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'chinese_chess');

    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByRole('heading', { name: '中国象棋' })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('三名玩家可以开始矮人矿坑', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guest1Context = await browser.newContext();
    const guest2Context = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guest1Page = await guest1Context.newPage();
    const guest2Page = await guest2Context.newPage();

    try {
      await loginAsGuest(hostPage);
      const guest1Name = await loginAsGuest(guest1Page);
      const guest2Name = await loginAsGuest(guest2Page);

      const roomId = await createRoom(hostPage, unique('房间'), 'dwarf_mine');

      await guest1Page.goto(`/games/dwarf_mine/room/${roomId}`);
      await guest2Page.goto(`/games/dwarf_mine/room/${roomId}`);

      const hostList = playerListSection(hostPage);
      await expect(hostList.getByText(guest1Name)).toBeVisible({ timeout: 15_000 });
      await expect(hostList.getByText(guest2Name)).toBeVisible({ timeout: 15_000 });

      await expect(async () => {
        await hostPage.getByRole('button', { name: '开始游戏' }).click();
        await expect(hostPage.locator('.badge', { hasText: '游戏中' })).toBeVisible({
          timeout: 3000,
        });
        await expect(hostPage.getByText(/第 1\/3 轮/)).toBeVisible({
          timeout: 3000,
        });
      }).toPass({ timeout: 20_000 });

      await expect(hostPage.locator('.badge', { hasText: '游戏中' })).toBeVisible();
    } finally {
      await hostContext.close();
      await guest1Context.close();
      await guest2Context.close();
    }
  });
});

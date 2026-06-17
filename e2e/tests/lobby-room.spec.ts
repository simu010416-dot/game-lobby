import { expect, test } from '@playwright/test';
import { addBot, createRoom, enterGameLobby, loginAsGuest, playerListSection, unique } from './helpers';

test.describe('大厅与房间', () => {
  test('创建房间后成为房主', async ({ page }) => {
    const host = await loginAsGuest(page);
    const roomName = unique('房间');

    await createRoom(page, roomName);

    const playerList = playerListSection(page);
    await expect(playerList.getByText(host)).toBeVisible();
    await expect(playerList.getByText('（房主）')).toBeVisible();
  });

  test('房间出现在游戏大厅列表中', async ({ page }) => {
    await loginAsGuest(page);
    const roomName = unique('房间');
    await createRoom(page, roomName);

    await enterGameLobby(page, 'da_vinci_code');
    await expect(page.getByRole('heading', { name: roomName })).toBeVisible();
  });

  test('房主可以添加电脑玩家', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'));

    const playerList = playerListSection(page);
    await expect(playerList.getByText(/电脑-/)).toHaveCount(0);

    await addBot(page);

    await expect(playerList.getByText(/电脑-/)).toHaveCount(1);
  });
});

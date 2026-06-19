import { expect, test } from '@playwright/test';
import {
  addBot,
  createRoom,
  enterGameLobby,
  joinRoomById,
  loginAsGuest,
  playerListSection,
  removeMember,
  unique,
} from './helpers';

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

  test('房主可以添加并移除电脑玩家', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'));

    const playerList = playerListSection(page);
    await addBot(page);
    await expect(playerList.getByText(/电脑-/)).toHaveCount(1);

    await removeMember(page, /电脑-/);
    await expect(playerList.getByText(/电脑-/)).toHaveCount(0);
  });

  test('房主可以移出普通玩家', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      await loginAsGuest(hostPage);
      const guestName = await loginAsGuest(guestPage);

      const roomId = await createRoom(hostPage, unique('房间'), 'da_vinci_code');
      const hostPlayerList = playerListSection(hostPage);

      await joinRoomById(guestPage, 'da_vinci_code', roomId);
      await expect(hostPlayerList.getByText(guestName)).toBeVisible();

      await removeMember(hostPage, guestName);
      await expect(hostPlayerList.getByText(guestName)).toHaveCount(0);

      await expect(guestPage.getByText('你已被房主移出房间，正在返回大厅…')).toBeVisible();
      await expect(guestPage.getByRole('heading', { name: '达芬奇密码 大厅' })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

import { expect, test } from '@playwright/test';
import { createRoom, loginAsGuest, playerListSection, unique } from './helpers';

test.describe('实时同步', () => {
  test('访客加入房间后，双方都能看到更新后的玩家列表', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const hostName = await loginAsGuest(hostPage);
      const guestName = await loginAsGuest(guestPage);

      const roomId = await createRoom(hostPage, unique('房间'), 'da_vinci_code');

      const hostPlayerList = playerListSection(hostPage);
      await expect(hostPlayerList.getByText(hostName)).toBeVisible();
      await expect(hostPlayerList.getByText(guestName)).toHaveCount(0);

      await guestPage.goto(`/games/da_vinci_code/room/${roomId}`);
      const guestPlayerList = playerListSection(guestPage);
      await expect(guestPlayerList.getByText(hostName)).toBeVisible();
      await expect(guestPlayerList.getByText(guestName)).toBeVisible();

      // The host should see the new player appear in realtime.
      await expect(hostPlayerList.getByText(guestName)).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

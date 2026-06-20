import { expect, type Locator, type Page } from '@playwright/test';

let counter = 0;

export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export async function loginAsGuest(page: Page, displayName?: string): Promise<string> {
  const name = displayName ?? unique('guest');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '访客进入' })).toBeVisible({ timeout: 30_000 });

  const guestInput = page.getByPlaceholder('显示名称', { exact: true });
  await expect(guestInput).toBeVisible();
  await guestInput.fill(name);
  await page.getByRole('button', { name: '以访客身份进入' }).click();

  await expect(page.getByRole('heading', { name: '选择游戏' })).toBeVisible();
  return name;
}

export async function registerUser(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: '没有账号？去注册' }).click();

  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: '注册', exact: true }).click();

  await expect(page.getByRole('heading', { name: '选择游戏' })).toBeVisible();
}

type E2eGameType =
  | 'undercover'
  | 'da_vinci_code'
  | 'draw_guess'
  | 'german_heart_attack'
  | 'werewolf'
  | 'chinese_chess'
  | 'dwarf_mine';

const LOBBY_HEADINGS: Record<E2eGameType, string> = {
  da_vinci_code: '达芬奇密码 大厅',
  undercover: '谁是卧底 大厅',
  draw_guess: '你画我猜 大厅',
  german_heart_attack: '德国心脏病 大厅',
  werewolf: '狼人杀 大厅',
  chinese_chess: '中国象棋 大厅',
  dwarf_mine: '矮人矿坑 大厅',
};

export async function enterGameLobby(
  page: Page,
  gameType: E2eGameType = 'da_vinci_code',
): Promise<void> {
  await page.goto(`/games/${gameType}`);
  await expect(page.getByRole('heading', { name: LOBBY_HEADINGS[gameType] })).toBeVisible();
}

export async function createRoom(
  page: Page,
  roomName: string,
  gameType: E2eGameType = 'da_vinci_code',
): Promise<string> {
  await enterGameLobby(page, gameType);

  await page.getByPlaceholder('新房间名称').fill(roomName);
  await page.getByRole('button', { name: '创建房间' }).click();

  await page.waitForURL(new RegExp(`/games/${gameType}/room/[0-9a-f-]+`));
  await expect(page.getByRole('heading', { name: roomName })).toBeVisible();

  const match = page.url().match(/\/room\/([0-9a-f-]+)/);
  if (!match) throw new Error(`Could not parse room id from URL: ${page.url()}`);
  return match[1]!;
}

export async function createRoomAndWait(
  page: Page,
  gameType: E2eGameType,
  roomName: string,
): Promise<string> {
  const roomId = await createRoom(page, roomName, gameType);
  return page.url();
}

export function playerListSection(page: Page): Locator {
  return page.locator('section.card', { hasText: '玩家列表' });
}

export async function addBot(page: Page): Promise<void> {
  const list = playerListSection(page);
  const expectedCount = (await list.getByText(/电脑-/).count()) + 1;

  await expect(async () => {
    if ((await list.getByText(/电脑-/).count()) < expectedCount) {
      await page.getByRole('button', { name: '添加电脑' }).click();
    }
    await expect(list.getByText(/电脑-/)).toHaveCount(expectedCount, { timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

export async function joinRoomById(
  page: Page,
  gameType: E2eGameType,
  roomId: string,
): Promise<void> {
  await page.goto(`/games/${gameType}/room/${roomId}`);
  await expect(playerListSection(page)).toBeVisible();
}

function playerRow(page: Page, displayName: string | RegExp): Locator {
  return playerListSection(page).locator('div').filter({ hasText: displayName }).first();
}

export async function removeMember(page: Page, displayName: string | RegExp): Promise<void> {
  const list = playerListSection(page);
  const row = playerRow(page, displayName);
  const isBot = typeof displayName === 'object' || displayName.includes('电脑-');
  const buttonName = isBot ? '移除' : '移出';

  if (!isBot) {
    page.once('dialog', (dialog) => void dialog.accept());
  }

  await row.getByRole('button', { name: buttonName }).click();

  if (isBot) {
    await expect(list.getByText(displayName)).toHaveCount(0);
  } else {
    await expect(list.getByText(displayName)).toHaveCount(0);
  }
}

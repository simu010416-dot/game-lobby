import { expect, type Locator, type Page } from '@playwright/test';

let counter = 0;

export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export async function loginAsGuest(page: Page, displayName?: string): Promise<string> {
  const name = displayName ?? unique('guest');
  await page.goto('/login');

  const guestInput = page.getByPlaceholder('显示名称', { exact: true });
  await expect(guestInput).toHaveValue(/.+/);
  await guestInput.fill(name);
  await expect(guestInput).toHaveValue(name);
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

export async function enterGameLobby(
  page: Page,
  gameType: 'undercover' | 'da_vinci_code' = 'da_vinci_code',
): Promise<void> {
  await page.goto(`/games/${gameType}`);
  const heading = gameType === 'da_vinci_code' ? '达芬奇密码 大厅' : '谁是卧底 大厅';
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

export async function createRoom(
  page: Page,
  roomName: string,
  gameType: 'undercover' | 'da_vinci_code' = 'da_vinci_code',
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

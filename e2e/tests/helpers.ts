import { expect, type Locator, type Page } from '@playwright/test';

let counter = 0;

// Unique-ish suffix so tests stay independent on the shared in-memory DB.
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

// Logs in as a guest and waits for the lobby to render.
export async function loginAsGuest(page: Page, displayName?: string): Promise<string> {
  const name = displayName ?? unique('guest');
  await page.goto('/login');

  const guestInput = page.getByPlaceholder('显示名称', { exact: true });
  // The page prefills this input asynchronously (fetchRandomGuestName). Wait for
  // that to settle first, otherwise it can overwrite our value after we fill it.
  await expect(guestInput).toHaveValue(/.+/);
  await guestInput.fill(name);
  await expect(guestInput).toHaveValue(name);
  await page.getByRole('button', { name: '以访客身份进入' }).click();

  await expect(page.getByRole('heading', { name: '游戏大厅' })).toBeVisible();
  return name;
}

// Registers a brand-new account and waits for the lobby to render.
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

  await expect(page.getByRole('heading', { name: '游戏大厅' })).toBeVisible();
}

// Creates a room from the lobby and waits until the room page is shown.
// Returns the room id parsed from the URL.
export async function createRoom(page: Page, roomName: string): Promise<string> {
  await page.getByPlaceholder('新房间名称').fill(roomName);
  await page.getByRole('button', { name: '创建房间' }).click();

  await page.waitForURL(/\/room\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: roomName })).toBeVisible();

  const match = page.url().match(/\/room\/([0-9a-f-]+)/);
  if (!match) throw new Error(`Could not parse room id from URL: ${page.url()}`);
  return match[1]!;
}

// Returns the "玩家列表" (player list) section card locator.
export function playerListSection(page: Page): Locator {
  return page.locator('section.card', { hasText: '玩家列表' });
}

// Adds exactly one bot, retrying the click to absorb the brief window where the
// Socket.io room-join (which registers membership) has not completed yet, during
// which the server silently drops the add-bot request.
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

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\tests\draw-guess.spec.ts >> draw guess game >> intermission shows game settings only once
- Location: e2e\tests\draw-guess.spec.ts:59:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login", waiting until "load"

```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from '@playwright/test';
  2  | 
  3  | let counter = 0;
  4  | 
  5  | export function unique(prefix: string): string {
  6  |   counter += 1;
  7  |   return `${prefix}_${Date.now().toString(36)}_${counter}`;
  8  | }
  9  | 
  10 | export async function loginAsGuest(page: Page, displayName?: string): Promise<string> {
  11 |   const name = displayName ?? unique('guest');
> 12 |   await page.goto('/login');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  13 | 
  14 |   const guestInput = page.getByPlaceholder('显示名称', { exact: true });
  15 |   await expect(guestInput).toHaveValue(/.+/);
  16 |   await guestInput.fill(name);
  17 |   await expect(guestInput).toHaveValue(name);
  18 |   await page.getByRole('button', { name: '以访客身份进入' }).click();
  19 | 
  20 |   await expect(page.getByRole('heading', { name: '选择游戏' })).toBeVisible();
  21 |   return name;
  22 | }
  23 | 
  24 | export async function registerUser(
  25 |   page: Page,
  26 |   username: string,
  27 |   password: string,
  28 | ): Promise<void> {
  29 |   await page.goto('/login');
  30 |   await page.getByRole('button', { name: '没有账号？去注册' }).click();
  31 | 
  32 |   await page.getByPlaceholder('用户名').fill(username);
  33 |   await page.getByPlaceholder('密码').fill(password);
  34 |   await page.getByRole('button', { name: '注册', exact: true }).click();
  35 | 
  36 |   await expect(page.getByRole('heading', { name: '选择游戏' })).toBeVisible();
  37 | }
  38 | 
  39 | export async function enterGameLobby(
  40 |   page: Page,
  41 |   gameType: 'undercover' | 'da_vinci_code' | 'draw_guess' = 'da_vinci_code',
  42 | ): Promise<void> {
  43 |   await page.goto(`/games/${gameType}`);
  44 |   const headings: Record<string, string> = {
  45 |     da_vinci_code: '达芬奇密码 大厅',
  46 |     undercover: '谁是卧底 大厅',
  47 |     draw_guess: '你画我猜 大厅',
  48 |   };
  49 |   await expect(page.getByRole('heading', { name: headings[gameType] })).toBeVisible();
  50 | }
  51 | 
  52 | export async function createRoom(
  53 |   page: Page,
  54 |   roomName: string,
  55 |   gameType: 'undercover' | 'da_vinci_code' | 'draw_guess' = 'da_vinci_code',
  56 | ): Promise<string> {
  57 |   await enterGameLobby(page, gameType);
  58 | 
  59 |   await page.getByPlaceholder('新房间名称').fill(roomName);
  60 |   await page.getByRole('button', { name: '创建房间' }).click();
  61 | 
  62 |   await page.waitForURL(new RegExp(`/games/${gameType}/room/[0-9a-f-]+`));
  63 |   await expect(page.getByRole('heading', { name: roomName })).toBeVisible();
  64 | 
  65 |   const match = page.url().match(/\/room\/([0-9a-f-]+)/);
  66 |   if (!match) throw new Error(`Could not parse room id from URL: ${page.url()}`);
  67 |   return match[1]!;
  68 | }
  69 | 
  70 | export async function createRoomAndWait(
  71 |   page: Page,
  72 |   gameType: 'undercover' | 'da_vinci_code' | 'draw_guess',
  73 |   roomName: string,
  74 | ): Promise<string> {
  75 |   const roomId = await createRoom(page, roomName, gameType);
  76 |   return page.url();
  77 | }
  78 | 
  79 | export function playerListSection(page: Page): Locator {
  80 |   return page.locator('section.card', { hasText: '玩家列表' });
  81 | }
  82 | 
  83 | export async function addBot(page: Page): Promise<void> {
  84 |   const list = playerListSection(page);
  85 |   const expectedCount = (await list.getByText(/电脑-/).count()) + 1;
  86 | 
  87 |   await expect(async () => {
  88 |     if ((await list.getByText(/电脑-/).count()) < expectedCount) {
  89 |       await page.getByRole('button', { name: '添加电脑' }).click();
  90 |     }
  91 |     await expect(list.getByText(/电脑-/)).toHaveCount(expectedCount, { timeout: 3000 });
  92 |   }).toPass({ timeout: 20_000 });
  93 | }
  94 | 
```
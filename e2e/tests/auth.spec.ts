import { expect, test } from '@playwright/test';
import { loginAsGuest, registerUser, unique } from './helpers';

test.describe('认证流程', () => {
  test('访客登录后进入大厅', async ({ page }) => {
    const name = await loginAsGuest(page);

    await expect(page).toHaveURL(/\/$|\/$/);
    await expect(page.getByRole('heading', { name: '游戏大厅' })).toBeVisible();
    // The header shows the current display name.
    await expect(page.getByText(name)).toBeVisible();
  });

  test('注册新账号后进入大厅', async ({ page }) => {
    const username = unique('user');
    await registerUser(page, username, 'password123');

    await expect(page.getByRole('heading', { name: '游戏大厅' })).toBeVisible();
    await expect(page.getByText(username)).toBeVisible();
  });

  test('密码错误时显示错误提示', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('用户名').fill(unique('nobody'));
    await page.getByPlaceholder('密码').fill('wrong-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();

    await expect(page.getByText('用户名或密码错误')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { loginAsGuest, createRoomAndWait } from './helpers';

async function findPainterAndGuesser(
  hostPage: Page,
  guestPage: Page,
): Promise<{ painter: Page; guesser: Page }> {
  if (
    await guestPage
      .getByRole('heading', { name: '请选择要画的词语' })
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    return { painter: guestPage, guesser: hostPage };
  }
  await expect(hostPage.getByRole('heading', { name: '请选择要画的词语' })).toBeVisible({
    timeout: 15_000,
  });
  return { painter: hostPage, guesser: guestPage };
}

async function playDrawGuessRound(painter: Page, guesser: Page) {
  const wordPanel = painter.locator('section.card', { hasText: '请选择要画的词语' });
  await expect(wordPanel).toBeVisible({ timeout: 15_000 });
  const wordBtn = wordPanel.getByRole('button').first();
  const word = (await wordBtn.textContent())?.trim();
  if (!word) throw new Error('No word option available for painter');
  await wordBtn.click();

  await guesser.getByPlaceholder('输入你的答案…').fill(word);
  await guesser.getByRole('button', { name: '发送' }).click();
}

test.describe('draw guess game', () => {
  test('two players can start draw guess room', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await loginAsGuest(hostPage, '画家A');
    await loginAsGuest(guestPage, '猜家B');

    const roomUrl = await createRoomAndWait(hostPage, 'draw_guess', '你画我猜测试房');
    await guestPage.goto(roomUrl);

    await expect(guestPage.getByText('你画我猜测试房')).toBeVisible({ timeout: 15_000 });

    await hostPage.getByRole('button', { name: '开始游戏' }).click();

    await expect(hostPage.getByText(/选词阶段|请选择要画的词语/)).toBeVisible({
      timeout: 15_000,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('intermission shows game settings only once', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await loginAsGuest(hostPage, '房主');
    await loginAsGuest(guestPage, '玩家');

    const roomUrl = await createRoomAndWait(hostPage, 'draw_guess', '局间测试房');
    await guestPage.goto(roomUrl);
    await expect(guestPage.getByText('局间测试房')).toBeVisible({ timeout: 15_000 });

    await expect(hostPage.getByRole('heading', { name: '游戏设置' })).toHaveCount(1);

    await hostPage.getByRole('button', { name: '开始游戏' }).click();
    await expect(hostPage.getByText(/选词阶段|请选择要画的词语/)).toBeVisible({
      timeout: 15_000,
    });

    let { painter, guesser } = await findPainterAndGuesser(hostPage, guestPage);
    await playDrawGuessRound(painter, guesser);
    await expect(hostPage.getByText('回合结算')).toBeVisible({ timeout: 15_000 });

    await hostPage.waitForTimeout(5500);

    ({ painter, guesser } = await findPainterAndGuesser(hostPage, guestPage));
    await playDrawGuessRound(painter, guesser);

    await expect(hostPage.getByText('局间休息')).toBeVisible({ timeout: 20_000 });
    await expect(hostPage.getByText('游戏结束')).toBeVisible();
    await expect(hostPage.getByRole('heading', { name: '游戏设置' })).toHaveCount(1);
    await expect(hostPage.getByRole('heading', { name: '玩家列表' })).toHaveCount(1);
    await expect(hostPage.getByRole('button', { name: '再来一局' })).toHaveCount(1);

    await hostContext.close();
    await guestContext.close();
  });
});

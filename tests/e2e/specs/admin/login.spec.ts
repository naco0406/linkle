import { expect, test } from '@playwright/test';

const API = 'http://localhost:8787';

test.describe('admin login', () => {
  test('shows the login form and surfaces a 401 error', async ({ page }) => {
    await page.route(`${API}/v1/admin/login`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"error":"bad-credentials"}',
      });
    });
    // Layout probes /v1/admin/challenges before redirecting to login; return 401
    // so we land on the login page.
    await page.route(/\/v1\/admin\/challenges/u, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"error":"unauthorized"}',
      });
    });

    await page.goto('/login');
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('wrong');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByRole('alert')).toContainText('올바르지 않습니다');
  });
});

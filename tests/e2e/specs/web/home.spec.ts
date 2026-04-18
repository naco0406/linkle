import { expect, test } from '@playwright/test';
import { mockNoChallenge, mockTodayChallenge } from '../../fixtures/apiRoutes.js';

test.describe('home', () => {
  test('shows today’s challenge and a start CTA', async ({ page }) => {
    await mockTodayChallenge(page, {
      date: '2026-04-18',
      startPage: '대한민국',
      endPage: '비틀즈',
      totalCount: 12,
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '오늘의 링클' })).toBeVisible();
    await expect(page.getByText('대한민국')).toBeVisible();
    await expect(page.getByText('비틀즈')).toBeVisible();
    await expect(page.getByRole('link', { name: '지금 시작하기' })).toBeVisible();
  });

  test('falls back to an error card when the challenge is missing', async ({ page }) => {
    await mockNoChallenge(page);
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('불러오지 못했어요');
  });
});

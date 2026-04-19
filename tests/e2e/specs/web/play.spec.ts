import { expect, test } from '@playwright/test';
import {
  mockRankingSubmission,
  mockTodayChallenge,
  mockWikipediaPages,
} from '../../fixtures/apiRoutes.js';

test.describe('game loop', () => {
  test('a single-link path triggers submission and navigates to /play/done', async ({ page }) => {
    await mockTodayChallenge(page, {
      date: '2026-04-18',
      startPage: '대한민국',
      endPage: '비틀즈',
    });
    await mockWikipediaPages(page, {
      대한민국: {
        title: '대한민국',
        html: `<p>테스트 문서입니다. <a href="/wiki/비틀즈">비틀즈</a>로 이동해보세요.</p>`,
      },
    });
    await mockRankingSubmission(page, { rank: 1 });

    await page.goto('/play');

    // The sanitized link should be present and clickable once the start page
    // HTML has loaded. Wait generously — first-page fetch + sanitize.
    const link = page.getByRole('link', { name: '비틀즈' });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();

    await expect(page).toHaveURL(/\/play\/done$/);
    await expect(page.getByRole('heading', { name: /도착했어요/u })).toBeVisible();
  });

  test('surfaces an error with a retry when the challenge fetch fails', async ({ page }) => {
    await page.route('http://localhost:8787/v1/challenges/today', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"x"}' });
    });
    await page.goto('/play');
    await expect(page.getByText('오늘의 챌린지를 불러오지 못했어요')).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(page.getByRole('link', { name: '홈으로' })).toBeVisible();
  });
});

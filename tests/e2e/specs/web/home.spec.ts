import { expect, test } from '@playwright/test';
import { mockNoChallenge, mockTodayChallenge } from '../../fixtures/apiRoutes.js';

test.describe('home', () => {
  test('shows the Linkle wordmark and the start CTA', async ({ page }) => {
    await mockTodayChallenge(page, {
      date: '2026-04-18',
      startPage: '대한민국',
      endPage: '비틀즈',
      totalCount: 12,
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Linkle' })).toBeVisible();
    await expect(page.getByText('매일 위키피디아 탐험하기')).toBeVisible();
    await expect(page.getByRole('link', { name: '시작' })).toBeVisible();
    await expect(page.getByText(/12.?명이 도전했어요/u)).toBeVisible();
  });

  test('surfaces a retry affordance when the challenge cannot be fetched', async ({ page }) => {
    await mockNoChallenge(page);
    await page.goto('/');

    await expect(page.getByText('오늘의 챌린지를 불러오지 못했어요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  });
});

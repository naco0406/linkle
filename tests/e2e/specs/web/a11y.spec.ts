import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockTodayChallenge } from '../../fixtures/apiRoutes.js';

test.describe('accessibility', () => {
  test('home page has no critical axe violations', async ({ page }, testInfo) => {
    await mockTodayChallenge(page, {
      date: '2026-04-18',
      startPage: '대한민국',
      endPage: '비틀즈',
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Linkle' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    await testInfo.attach('axe-results', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, critical.map((v) => v.id).join(', ')).toEqual([]);
  });
});

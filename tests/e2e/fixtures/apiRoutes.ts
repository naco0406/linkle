// Shared API route fixtures. Each helper accepts a `page` and wires the
// necessary route handlers onto it before the spec drives the UI.

import type { Page, Route } from '@playwright/test';

export interface ChallengeFixture {
  date: string;
  startPage: string;
  endPage: string;
  totalCount?: number;
}

const API_BASE = 'http://localhost:8787';

function json(
  data: unknown,
  init: { status?: number } = {},
): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status: init.status ?? 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

export async function mockTodayChallenge(page: Page, c: ChallengeFixture): Promise<void> {
  await page.route(`${API_BASE}/v1/challenges/today`, async (route: Route) => {
    await route.fulfill(json({ challenge: { ...c, totalCount: c.totalCount ?? 0 } }));
  });
}

export async function mockNoChallenge(page: Page): Promise<void> {
  await page.route(`${API_BASE}/v1/challenges/today`, async (route: Route) => {
    await route.fulfill(json({ error: 'no-challenge' }, { status: 404 }));
  });
}

export async function mockRankingSubmission(
  page: Page,
  response: { rankingId?: string; rank?: number; status?: number } = {},
): Promise<void> {
  await page.route(`${API_BASE}/v1/rankings`, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (response.status && response.status >= 400) {
      await route.fulfill(json({ error: 'forbidden' }, { status: response.status }));
      return;
    }
    await route.fulfill(
      json(
        {
          rankingId: response.rankingId ?? 'rk_mock',
          rank: response.rank ?? 1,
          emojiDeferred: true,
        },
        { status: 201 },
      ),
    );
  });
}

/**
 * Intercept Wikipedia parse API calls with a canned HTML payload.
 * The HTML should include a `/wiki/<endPage>` link so the test can click it.
 */
export async function mockWikipediaPages(
  page: Page,
  pagesByTitle: Record<string, { title: string; html: string }>,
): Promise<void> {
  await page.route(
    (url) => url.host === 'ko.wikipedia.org' && url.pathname === '/w/api.php',
    async (route: Route) => {
      const reqUrl = new URL(route.request().url());
      const title = reqUrl.searchParams.get('page') ?? '';
      const entry = pagesByTitle[title] ?? {
        title,
        html: `<p>기본 가짜 본문: <a href="/wiki/기타_주제">기타 주제</a></p>`,
      };
      await route.fulfill(
        json({
          parse: {
            title: entry.title,
            text: { '*': entry.html },
            fullurl: `https://ko.wikipedia.org/wiki/${encodeURIComponent(entry.title)}`,
            sections: [],
          },
        }),
      );
    },
  );
}

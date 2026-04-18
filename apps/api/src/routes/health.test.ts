import { describe, expect, it } from 'vitest';
import app from '../index.js';

// Smoke: verify the Hono app wires routes and responds. Routes that require
// a D1 binding are exercised in Phase 8 Playwright tests against wrangler dev.
describe('health & routing', () => {
  it('returns service metadata from /', async () => {
    const res = await app.request('/', {}, fakeEnv());
    expect(res.status).toBe(200);
    const body: unknown = JSON.parse(await res.text());
    expect(body).toMatchObject({ service: 'linkle-api' });
  });

  it('returns ok from /v1/health', async () => {
    const res = await app.request('/v1/health', {}, fakeEnv());
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown paths', async () => {
    const res = await app.request('/totally-unknown', {}, fakeEnv());
    expect(res.status).toBe(404);
  });
});

/** Minimal env stub — no DB access required for these assertions. */
function fakeEnv(): Record<string, unknown> {
  return {
    DB: {} as unknown,
    ALLOWED_ORIGINS: 'http://localhost:5173',
    OPENAI_MODEL: 'gpt-4o-mini',
  };
}

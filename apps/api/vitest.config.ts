import { defineProject } from 'vitest/config';

// Worker unit tests run on Node (Hono is runtime-agnostic). Full D1-backed
// integration tests run via Playwright against a live `wrangler dev` (see
// tests/e2e and docs/harness.md §9).
export default defineProject({
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

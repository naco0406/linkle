import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'design-system',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});

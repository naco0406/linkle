import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineProject({
  plugins: [react()],
  test: {
    name: 'admin',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});

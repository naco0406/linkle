import { linkleTailwindPreset } from '@linkle/design-system/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  presets: [linkleTailwindPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
} satisfies Config;

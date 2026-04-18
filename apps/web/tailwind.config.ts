import { linkleTailwindPreset } from '@linkle/design-system/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  presets: [linkleTailwindPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Pull in design-system sources so their Tailwind classes get emitted.
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
} satisfies Config;

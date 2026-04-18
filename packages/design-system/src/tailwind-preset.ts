// Shared Tailwind preset consumed by apps/web and apps/admin.
// Extends consumer tailwind.config — apps provide their own `content` globs.
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import {
  animation,
  boxShadow,
  fontFamily,
  fontSize,
  fontWeight,
  keyframes,
  radius,
} from './tokens/index.js';

// Colors are wired through CSS variables so runtime theming stays consistent.
const cssVarColor = (name: string) => `hsl(var(${name}) / <alpha-value>)`;

export const linkleTailwindPreset = {
  darkMode: ['class'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        md: '1.5rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1200px',
      },
    },
    extend: {
      colors: {
        linkle: {
          DEFAULT: cssVarColor('--linkle'),
          foreground: cssVarColor('--linkle-foreground'),
        },
        background: cssVarColor('--background'),
        foreground: cssVarColor('--foreground'),
        card: {
          DEFAULT: cssVarColor('--card'),
          foreground: cssVarColor('--card-foreground'),
        },
        muted: {
          DEFAULT: cssVarColor('--muted'),
          foreground: cssVarColor('--muted-foreground'),
        },
        accent: {
          DEFAULT: cssVarColor('--accent'),
          foreground: cssVarColor('--accent-foreground'),
        },
        destructive: {
          DEFAULT: cssVarColor('--destructive'),
          foreground: cssVarColor('--destructive-foreground'),
        },
        border: cssVarColor('--border'),
        input: cssVarColor('--input'),
        ring: cssVarColor('--ring'),
        popover: {
          DEFAULT: cssVarColor('--card'),
          foreground: cssVarColor('--card-foreground'),
        },
      },
      fontFamily: {
        sans: fontFamily.sans,
        serif: fontFamily.serif,
        mono: fontFamily.mono,
      },
      fontSize,
      fontWeight,
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        '2xl': radius['2xl'],
      },
      boxShadow,
      keyframes,
      animation,
      maxWidth: {
        shell: '30rem', // 480px — primary mobile-first column
      },
      screens: {
        xs: '380px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

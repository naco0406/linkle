// Typography tokens. See docs/design-system.md §3.

// Tailwind expects mutable array shapes; we expose them that way and let the
// caller `readonly`-wrap if they want compile-time immutability.
export const fontFamily: Record<'sans' | 'serif' | 'mono', string[]> = {
  sans: [
    '"Pretendard Variable"',
    'Pretendard',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Apple SD Gothic Neo"',
    '"Noto Sans KR"',
    'system-ui',
    'sans-serif',
  ],
  serif: ['"Rhodium Libre"', 'ui-serif', 'Georgia', 'serif'],
  mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
};

type FontSizeTuple = [string, { lineHeight: string }];
export const fontSize: Record<
  'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
  FontSizeTuple
> = {
  xs: ['0.75rem', { lineHeight: '1rem' }],
  sm: ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem', { lineHeight: '1.5rem' }],
  lg: ['1.125rem', { lineHeight: '1.75rem' }],
  xl: ['1.25rem', { lineHeight: '1.75rem' }],
  '2xl': ['1.5rem', { lineHeight: '2rem' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  '5xl': ['3rem', { lineHeight: '1' }],
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

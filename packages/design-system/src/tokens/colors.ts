// Design tokens — color.
// The source of truth for colors is `src/styles/globals.css` (as CSS variables).
// These constants mirror those values for JS-side access (e.g. canvas-confetti).
// See docs/design-system.md §2.

export const colors = {
  linkle: '#3366CC',
  linkleForeground: '#FFFFFF',
  background: '#F3F7FF',
  foreground: '#1A2236',
  card: '#FFFFFF',
  cardForeground: '#1A2236',
  muted: '#E3EAF5',
  mutedForeground: '#666F85',
  accent: '#E1ECFA',
  accentForeground: '#1A2236',
  border: '#CDD6E3',
  input: '#CDD6E3',
  ring: '#3366CC',
  destructive: '#D93535',
  destructiveForeground: '#FFFFFF',
} as const satisfies Record<string, `#${string}`>;

export type ColorToken = keyof typeof colors;

// HSL space (H S% L%) — matches CSS custom properties in globals.css.
export const colorsHsl = {
  linkle: '217 60% 50%',
  linkleForeground: '0 0% 100%',
  background: '217 67% 97%',
  foreground: '220 30% 15%',
  card: '0 0% 100%',
  cardForeground: '220 30% 15%',
  muted: '217 30% 92%',
  mutedForeground: '220 15% 45%',
  accent: '217 60% 94%',
  accentForeground: '220 30% 15%',
  border: '217 25% 85%',
  input: '217 25% 85%',
  ring: '217 60% 50%',
  destructive: '0 70% 50%',
  destructiveForeground: '0 0% 100%',
} as const satisfies Record<ColorToken, string>;

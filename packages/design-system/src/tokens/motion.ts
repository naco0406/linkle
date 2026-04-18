// Motion tokens. See docs/design-system.md §5.

export const duration = {
  fast: '150ms',
  base: '250ms',
  slow: '400ms',
  accordion: '200ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const keyframes = {
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },
  'gradient-x': {
    '0%, 100%': { 'background-position': '0% 50%' },
    '50%': { 'background-position': '100% 50%' },
  },
  'fade-in': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  'slide-up': {
    from: { opacity: '0', transform: 'translateY(8px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
  },
} as const;

export const animation = {
  'accordion-down': `accordion-down ${duration.accordion} ${easing.standard}`,
  'accordion-up': `accordion-up ${duration.accordion} ${easing.standard}`,
  'gradient-x': 'gradient-x 5s linear infinite',
  'fade-in': `fade-in ${duration.base} ${easing.standard}`,
  'slide-up': `slide-up ${duration.slow} ${easing.emphasized}`,
} as const;

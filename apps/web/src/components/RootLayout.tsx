import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Router shell. Keeps only the a11y skip-link and renders the matched route.
 *
 * Each route owns its own header; the root no longer carries a global top
 * nav. Rationale: Home already has its own brand+icon chrome, /play and
 * /play/done are full-bleed game surfaces, and /ranking /yesterday /about
 * each render a simple "← 홈" back header locally. This avoids the
 * double-chrome problem we had before.
 */
export function RootLayout(): JSX.Element {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <a
        href="#main"
        className="focus-visible:bg-card focus-visible:shadow-card sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-3 focus-visible:py-2"
      >
        본문으로 건너뛰기
      </a>
      <div id="main">
        <Outlet />
      </div>
    </div>
  );
}

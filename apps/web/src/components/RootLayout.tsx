import type { JSX } from 'react';
import { Link, Outlet } from 'react-router-dom';

export function RootLayout(): JSX.Element {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <a
        href="#main"
        className="focus-visible:bg-card focus-visible:shadow-card sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-3 focus-visible:py-2"
      >
        본문으로 건너뛰기
      </a>
      <header className="max-w-shell mx-auto flex items-center justify-between px-4 py-4 md:px-6">
        <Link to="/" className="text-foreground font-serif text-xl tracking-tight">
          Linkle
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-3 text-sm">
          <Link className="text-muted-foreground hover:text-foreground" to="/ranking">
            랭킹
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" to="/yesterday">
            어제
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" to="/about">
            소개
          </Link>
        </nav>
      </header>
      <div id="main">
        <Outlet />
      </div>
    </div>
  );
}

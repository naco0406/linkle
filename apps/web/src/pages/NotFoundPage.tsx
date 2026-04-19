import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@linkle/design-system';

export function NotFoundPage(): JSX.Element {
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-foreground font-serif text-5xl">404</h1>
        <p className="text-muted-foreground text-sm">페이지를 찾을 수 없어요.</p>
        <Button asChild>
          <Link to="/">홈으로</Link>
        </Button>
      </div>
    </main>
  );
}

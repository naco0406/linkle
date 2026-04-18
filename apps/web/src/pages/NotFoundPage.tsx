import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageShell } from '@linkle/design-system';

export function NotFoundPage(): JSX.Element {
  return (
    <PageShell>
      <div className="py-16 text-center">
        <h1 className="text-foreground font-serif text-4xl">404</h1>
        <p className="text-muted-foreground mt-2 text-sm">페이지를 찾을 수 없어요.</p>
      </div>
      <Button asChild block>
        <Link to="/">홈으로</Link>
      </Button>
    </PageShell>
  );
}

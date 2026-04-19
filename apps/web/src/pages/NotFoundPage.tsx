import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@linkle/design-system';
import { AppShell } from '../components/AppShell.js';

export function NotFoundPage(): JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col items-center gap-5 py-16 text-center">
        <p className="text-linkle font-serif text-6xl font-normal">404</p>
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-lg font-semibold">페이지를 찾을 수 없어요</p>
          <p className="text-muted-foreground text-sm">
            주소가 잘못되었거나 더 이상 사용되지 않는 페이지예요.
          </p>
        </div>
        <Button asChild>
          <Link to="/">홈으로</Link>
        </Button>
      </div>
    </AppShell>
  );
}

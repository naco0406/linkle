import { useEffect, useState, type JSX } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@linkle/design-system';
import { env } from '../config/env.js';
import { logout } from '../lib/api.js';

/**
 * A minimal admin chrome: brand row + logout. Auth is cookie-based; the
 * first protected fetch will 401 if no session, and we redirect to /login.
 */
export function AdminLayout(): JSX.Element {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Quick probe: try listing challenges; if 401, bounce to login.
    const run = async (): Promise<void> => {
      try {
        const res = await fetch(
          `${env.apiBaseUrl}/v1/admin/challenges?from=2024-09-15&to=2024-09-15`,
          { credentials: 'include' },
        );
        if (res.status === 401) {
          void navigate('/login', { replace: true });
          return;
        }
      } finally {
        setReady(true);
      }
    };
    void run();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="text-muted-foreground grid min-h-dvh place-items-center text-sm">
        확인 중…
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border bg-card border-b">
        <div className="max-w-shell mx-auto flex items-center justify-between px-4 py-3 md:max-w-5xl md:px-6">
          <Link to="/" className="font-serif text-lg">
            Linkle <span className="text-muted-foreground">admin</span>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void (async () => {
                await logout();
                await navigate('/login', { replace: true });
              })();
            }}
          >
            로그아웃
          </Button>
        </div>
      </header>
      <main className="max-w-shell mx-auto px-4 py-6 md:max-w-5xl md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

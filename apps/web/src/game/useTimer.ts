import { useEffect, useState } from 'react';

/**
 * Wall-clock elapsed ms since `startedAt`. Ticks every 250ms while running,
 * which is plenty for a minute:second display and cheap enough to not matter
 * on even very old devices.
 */
export function useElapsedMs(startedAt: number | null, running: boolean): number {
  const [elapsed, setElapsed] = useState(() =>
    startedAt === null ? 0 : Math.max(0, Date.now() - startedAt),
  );

  useEffect(() => {
    if (startedAt === null || !running) return undefined;
    setElapsed(Math.max(0, Date.now() - startedAt));
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Date.now() - startedAt));
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [startedAt, running]);

  return elapsed;
}

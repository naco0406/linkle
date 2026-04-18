import { useEffect } from 'react';

/**
 * Watch for the in-page search hotkey (Ctrl+F / Cmd+F). We can't actually
 * stop the browser from opening find — but we can trigger a forced end as
 * soon as the key combo is observed, before the user can read any result.
 */
export function useSearchGuard(onDetected: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        onDetected();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
    };
  }, [onDetected]);
}

import * as React from 'react';
import { cn } from '../../lib/cn.js';

export interface TimerPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elapsed time in milliseconds. */
  elapsedMs: number;
  /** Visually emphasize (e.g. running). */
  active?: boolean;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Monospaced time badge shown in-game. Designed to be stable-width so the
 * surrounding layout never jitters as seconds tick over.
 */
export function TimerPill({ elapsedMs, active = false, className, ...props }: TimerPillProps) {
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label="경과 시간"
      className={cn(
        'inline-flex h-9 items-center rounded-full px-3 font-mono text-sm font-semibold tabular-nums',
        active ? 'bg-linkle text-linkle-foreground' : 'bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      {formatElapsed(elapsedMs)}
    </div>
  );
}

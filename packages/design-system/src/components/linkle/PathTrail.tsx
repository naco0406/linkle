import * as React from 'react';
import { ChevronRight, Undo2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

// Kept loose so this component can consume either the shared PathEntry union
// or a simpler string list. Apps normalize before passing.
export type PathTrailEntry =
  | { readonly type: 'page'; readonly title: string }
  | { readonly type: 'back' };

export interface PathTrailProps extends React.HTMLAttributes<HTMLOListElement> {
  path: readonly PathTrailEntry[];
  /** Visually emphasise the last page (the destination). */
  highlightGoal?: boolean;
}

/**
 * Ordered visualization of the player's path. Avoids horizontal scrolling by
 * wrapping chips and inline arrows, so the trail stays legible on mobile.
 */
export function PathTrail({ path, highlightGoal = false, className, ...props }: PathTrailProps) {
  const lastIndex = path.length - 1;
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-1 gap-y-2 text-sm', className)} {...props}>
      {path.map((entry, index) => {
        const isLast = index === lastIndex;
        const isGoal = highlightGoal && isLast && entry.type === 'page';
        return (
          <React.Fragment key={`${entry.type}-${index}`}>
            <li
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1',
                entry.type === 'back'
                  ? 'border-muted bg-muted text-muted-foreground'
                  : isGoal
                    ? 'border-linkle bg-linkle text-linkle-foreground'
                    : 'border-border bg-card text-foreground',
              )}
            >
              {entry.type === 'back' ? (
                <>
                  <Undo2 size={14} aria-hidden />
                  <span>뒤로가기</span>
                </>
              ) : (
                <span className="font-semibold">{entry.title}</span>
              )}
            </li>
            {isLast ? null : (
              <ChevronRight aria-hidden size={14} className="text-muted-foreground shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

import type { JSX, ReactNode } from 'react';
import { cn } from '@linkle/design-system';

export interface PageTitleProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Right-aligned slot (e.g. a "new" button). */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/**
 * Standard page header used inside AppShell. Keeps h1 rhythm consistent:
 * Rhodium Libre serif at 3xl, muted sans subtitle on the line below.
 * Actions slot sits to the right on mobile too, collapsing to a second row
 * when things get tight.
 */
export function PageTitle({ title, subtitle, actions, className }: PageTitleProps): JSX.Element {
  return (
    <header className={cn('mb-6 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-foreground truncate font-serif text-3xl font-normal sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

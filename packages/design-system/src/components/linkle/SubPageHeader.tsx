import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn.js';

export interface SubPageHeaderProps {
  /** Heading text, e.g. "오늘의 랭킹". */
  title: string;
  /** Optional small line of meta text under the title (e.g. date). */
  subtitle?: string;
  /** href that Back navigates to. Defaults to "/". */
  backHref?: string;
  /** Optional right-aligned slot (icons, secondary actions). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Simple header used by `/ranking`, `/yesterday`, `/about`. Gives the user a
 * one-tap way back to home without needing a global nav bar. The game
 * surfaces (`/play`, `/play/done`) and home (`/`) have their own bespoke
 * chrome and do not use this component.
 */
export function SubPageHeader({
  title,
  subtitle,
  backHref = '/',
  actions,
  className,
}: SubPageHeaderProps): React.ReactElement {
  return (
    <header
      className={cn(
        'border-border bg-background flex items-center gap-3 border-b',
        'h-[60px] px-4 md:h-[72px] md:px-6',
        className,
      )}
    >
      <a
        href={backHref}
        aria-label="홈으로"
        className={cn(
          'text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-md',
          'hover:bg-muted transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <ArrowLeft size={22} />
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[18px] font-semibold md:text-[22px]">{title}</p>
        {subtitle ? <p className="text-muted-foreground truncate text-xs">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

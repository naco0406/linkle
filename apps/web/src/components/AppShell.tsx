import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpDialog, cn } from '@linkle/design-system';
import { CircleHelp, Trophy, type LucideIcon } from 'lucide-react';

interface AppShellProps {
  readonly children: ReactNode;
  /** Use a slightly wider main column for tables/lists. */
  readonly wide?: boolean;
  readonly className?: string;
}

/**
 * Standard chrome for non-game surfaces (`/ranking`, `/yesterday`, `/about`,
 * `/play/done`, 404).
 *
 * The design language is meant to be subtle — the brand wordmark acts as the
 * home link (Apple/Tesla convention), utility icons sit in the opposite
 * corner, and the content column narrows to `max-w-shell` (~480px) so
 * mobile-first typography stays legible on desktop. Header/footer extend to
 * `max-w-3xl` so the chrome doesn't feel pinched on wide screens.
 *
 * Home (`/`) deliberately does NOT use this shell — it's a full-bleed hero.
 * Both surfaces share tokens (Rhodium Libre wordmark, brand blue, utility
 * icon style) so the visual language stays consistent even though the
 * layouts differ.
 */
export function AppShell({ children, wide = false, className }: AppShellProps): JSX.Element {
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Kick in a subtle shadow under the sticky header once the user has
    // scrolled past the initial viewport. Purely cosmetic — tells the eye
    // that the top bar is floating above content.
    const onScroll = (): void => {
      setScrolled(window.scrollY > 4);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className={cn('bg-background text-foreground flex min-h-dvh flex-col', className)}>
      <header
        className={cn(
          'border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur-sm',
          'transition-shadow duration-200',
          scrolled && 'shadow-[0_1px_0_rgba(0,0,0,0.03),0_4px_12px_rgba(26,34,54,0.06)]',
        )}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:h-16 md:px-6">
          <Link
            to="/"
            aria-label="홈으로"
            className={cn(
              '-ml-1 inline-flex items-center rounded-md px-1 py-0.5',
              'text-linkle font-serif text-xl md:text-2xl',
              'hover:bg-muted/50 transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            Linkle
          </Link>
          <div className="-mr-1 flex items-center gap-0.5">
            <UtilityLink to="/yesterday" icon={Trophy} label="어제의 링클" />
            <UtilityButton
              onClick={() => {
                setHelpOpen(true);
              }}
              icon={CircleHelp}
              label="게임 규칙 보기"
            />
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full flex-1 px-4 py-6 md:px-6 md:py-8',
          wide ? 'max-w-3xl' : 'max-w-shell',
        )}
      >
        {children}
      </main>

      <footer className="border-border border-t">
        <p className="text-muted-foreground mx-auto max-w-3xl px-4 py-4 text-center text-xs md:px-6">
          © {new Date().getFullYear()} Linkle
        </p>
      </footer>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

// ─── local utility icon components ────────────────────────────────────────
// Kept private: every use on this site goes through AppShell or HomePage,
// and exposing them via design-system would force design-system to depend
// on react-router-dom.

const iconButtonClass = cn(
  'inline-flex size-10 items-center justify-center rounded-full',
  'text-foreground/80 transition-colors',
  'hover:bg-muted hover:text-foreground',
  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
);

export function UtilityLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
}): JSX.Element {
  return (
    <Link to={to} aria-label={label} className={iconButtonClass}>
      <Icon size={20} aria-hidden />
    </Link>
  );
}

export function UtilityButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}): JSX.Element {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={iconButtonClass}>
      <Icon size={20} aria-hidden />
    </button>
  );
}

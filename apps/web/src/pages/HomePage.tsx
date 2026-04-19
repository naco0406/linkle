import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, Card, CardContent, EmojiSquareLine, HelpDialog, cn } from '@linkle/design-system';
import { CircleHelp, Trophy, type LucideIcon } from 'lucide-react';
import { challengeDayNumber, getKstToday } from '@linkle/shared';
import { fetchTodayChallenge } from '../lib/api.js';
import { loadLocalDailyState } from '../lib/localDailyStore.js';

/**
 * Home — the first surface every day. Full-bleed, hero-oriented: everything
 * pulls the eye toward the brand mark, the day number, and a single primary
 * action ("시작"). Cleared state collapses the decision into a compact
 * result card rather than repeating the full /play/done screen.
 *
 * Shares tokens with AppShell (brand wordmark, utility icons, button/card
 * styles) but owns its own layout so the landing keeps its "hero" character.
 */
export function HomePage(): JSX.Element {
  const today = getKstToday();
  const saved = loadLocalDailyState(today);
  const challengeQuery = useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: fetchTodayChallenge,
  });

  const dayNumber = challengeDayNumber(today);
  const [helpOpen, setHelpOpen] = useState(false);

  const hasStartedToday = saved?.status === 'playing';
  const hasClearedToday = saved?.status === 'completed';

  return (
    <main className="bg-background relative flex min-h-dvh flex-col items-center justify-between px-6 pb-8 pt-5">
      {/* Utility icons — mirror AppShell's right-side cluster. */}
      <div className="absolute right-3 top-3 flex items-center gap-0.5 md:right-5 md:top-5">
        <IconLink to="/yesterday" icon={Trophy} label="어제의 링클" />
        <IconAction
          onClick={() => {
            setHelpOpen(true);
          }}
          icon={CircleHelp}
          label="게임 규칙 보기"
        />
      </div>

      <div aria-hidden />

      <section className="flex w-full max-w-md flex-col items-center gap-8">
        <BrandMark dayNumber={dayNumber} />

        {hasClearedToday ? (
          <ClearedCard
            dayNumber={dayNumber}
            moveCount={saved.moveCount}
            timeSec={saved.timeSec}
            rank={saved.rank}
            emojiResult={saved.emojiResult}
          />
        ) : (
          <StartCta
            label={hasStartedToday ? '이어서 도전하기' : '시작'}
            disabled={!challengeQuery.data}
            hasError={challengeQuery.isError}
            totalCount={challengeQuery.data?.totalCount ?? null}
            onRetry={() => void challengeQuery.refetch()}
          />
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        © {new Date().getFullYear()}{' '}
        <Link to="/about" className="text-linkle font-medium underline-offset-4 hover:underline">
          Linkle
        </Link>
      </p>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </main>
  );
}

// ─── Brand ──────────────────────────────────────────────────────────────

function BrandMark({ dayNumber }: { readonly dayNumber: number }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-3">
        <h1 className="text-linkle font-serif text-7xl font-normal sm:text-8xl">Linkle</h1>
        <span className="text-muted-foreground mb-3 font-serif text-lg sm:mb-4 sm:text-xl">
          #{dayNumber}
        </span>
      </div>
      <p className="text-foreground/65 text-base sm:text-lg">매일 위키피디아 탐험하기</p>
    </div>
  );
}

// ─── Start CTA ─────────────────────────────────────────────────────────

interface StartCtaProps {
  label: string;
  disabled: boolean;
  hasError: boolean;
  totalCount: number | null;
  onRetry: () => void;
}

function StartCta({ label, disabled, hasError, totalCount, onRetry }: StartCtaProps): JSX.Element {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Button
        asChild={!disabled}
        size="lg"
        disabled={disabled}
        aria-disabled={disabled}
        className="h-14 rounded-full px-16 text-base font-semibold tracking-tight"
      >
        {disabled ? <span>{label}</span> : <Link to="/play">{label}</Link>}
      </Button>
      {hasError ? (
        <p className="text-destructive text-center text-sm">
          오늘의 챌린지를 불러오지 못했어요.{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            다시 시도
          </button>
        </p>
      ) : totalCount !== null ? (
        <p className="text-muted-foreground text-xs">
          {totalCount > 0
            ? `지금까지 ${String(totalCount)}명이 도전했어요.`
            : '오늘 첫 도전자가 되어보세요.'}
        </p>
      ) : null}
    </div>
  );
}

// ─── Cleared card ──────────────────────────────────────────────────────

interface ClearedCardProps {
  dayNumber: number;
  moveCount: number;
  timeSec: number | null;
  rank: number | null;
  emojiResult: string | null;
}

function ClearedCard({
  dayNumber,
  moveCount,
  timeSec,
  rank,
  emojiResult,
}: ClearedCardProps): JSX.Element {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="flex flex-col items-center gap-1">
          <p className="text-foreground text-base font-semibold">{dayNumber}번째 링클 클리어 ✓</p>
          {rank !== null ? (
            <p className="text-muted-foreground text-sm">
              일일 <span className="text-linkle font-semibold">{rank}</span>등
            </p>
          ) : null}
        </div>

        <div className="flex items-baseline gap-6 font-mono text-sm tabular-nums">
          <span className="text-muted-foreground">
            이동 <span className="text-foreground font-semibold">{moveCount}회</span>
          </span>
          <span className="text-muted-foreground">
            시간 <span className="text-foreground font-semibold">{formatSeconds(timeSec)}</span>
          </span>
        </div>

        {emojiResult ? (
          <EmojiSquareLine result={emojiResult} />
        ) : (
          <p className="text-muted-foreground text-xs">경로 분석을 준비 중이에요.</p>
        )}

        <div className="flex w-full gap-2">
          <Button asChild block variant="outline">
            <Link to="/play/done">자세히</Link>
          </Button>
          <Button asChild block>
            <Link to="/ranking">랭킹</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── local utility icon components ─────────────────────────────────────

const iconButtonClass = cn(
  'inline-flex size-10 items-center justify-center rounded-full',
  'text-foreground/80 transition-colors',
  'hover:bg-muted hover:text-foreground',
  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
);

function IconLink({
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

function IconAction({
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

function formatSeconds(timeSec: number | null): string {
  if (timeSec === null) return '—';
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

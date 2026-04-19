import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, EmojiSquareLine, HelpDialog, cn } from '@linkle/design-system';
import { CircleHelp, Trophy } from 'lucide-react';
import { challengeDayNumber, getKstToday } from '@linkle/shared';
import { fetchTodayChallenge } from '../lib/api.js';
import { loadLocalDailyState } from '../lib/localDailyStore.js';

/**
 * Home screen — the first surface a returning player sees each day.
 *
 * Mood follows the original wikirace's Start screen (big serif wordmark,
 * light subtitle, a single round-pill CTA). Differences vs. the old:
 *   - When the player has already cleared today we keep them on /play/done
 *     by directing them there; the home screen just acknowledges the
 *     win and offers the usual destinations, instead of duplicating the
 *     full result layout here.
 *   - The "continue vs start" copy is driven by LocalDailyState rather
 *     than separate booleans.
 *   - No admin shortcut here — admins use the dedicated admin app.
 */
export function HomePage(): JSX.Element {
  const today = getKstToday();
  const savedState = loadLocalDailyState(today);
  const challengeQuery = useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: fetchTodayChallenge,
  });

  const dayNumber = challengeDayNumber(today);
  const [helpOpen, setHelpOpen] = useState(false);

  const hasStartedToday = savedState?.status === 'playing';
  const hasClearedToday = savedState?.status === 'completed';
  const ctaLabel = hasStartedToday ? '이어서 도전하기' : '시작';
  const disableCta = !challengeQuery.data;

  return (
    <main className="bg-background relative flex min-h-[calc(100dvh-72px)] w-full flex-col items-center justify-center overflow-hidden px-6">
      {/* Top-right icon cluster — Trophy (yesterday), Help. */}
      <div className="absolute right-2 top-0 flex h-[80px] items-center gap-1 px-2">
        <Link
          to="/yesterday"
          aria-label="어제의 링클 보기"
          className={cn(
            'text-foreground/80 inline-flex size-10 items-center justify-center rounded-md',
            'hover:bg-muted hover:text-foreground transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <Trophy size={22} />
        </Link>
        <button
          type="button"
          onClick={() => {
            setHelpOpen(true);
          }}
          aria-label="게임 규칙 보기"
          className={cn(
            'text-foreground/80 inline-flex size-10 items-center justify-center rounded-md',
            'hover:bg-muted hover:text-foreground transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <CircleHelp size={22} />
        </button>
      </div>

      <div className="flex flex-row items-end gap-2">
        <h1 className="text-linkle font-serif text-6xl font-normal sm:text-8xl">Linkle</h1>
        <span className="text-linkle mb-2 font-serif text-base sm:mb-4 sm:text-xl">
          #{dayNumber}
        </span>
      </div>

      {hasClearedToday ? (
        <ClearedSummary
          dayNumber={dayNumber}
          moveCount={savedState.moveCount}
          timeSec={savedState.timeSec}
          rank={savedState.rank}
          emojiResult={savedState.emojiResult}
        />
      ) : (
        <>
          <p className="text-foreground/70 mb-10 mt-6 text-base sm:text-lg">
            매일 위키피디아 탐험하기
          </p>
          <Button
            asChild={!disableCta}
            size="lg"
            disabled={disableCta}
            aria-disabled={disableCta}
            className="h-14 rounded-full px-16 text-lg font-semibold"
          >
            {disableCta ? <span>{ctaLabel}</span> : <Link to="/play">{ctaLabel}</Link>}
          </Button>
          {challengeQuery.isError ? (
            <p className="text-destructive mt-4 text-sm">
              오늘의 챌린지를 불러오지 못했어요.{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void challengeQuery.refetch()}
              >
                다시 시도
              </button>
            </p>
          ) : null}
          {challengeQuery.data ? (
            <p className="text-muted-foreground mt-6 text-xs">
              {challengeQuery.data.totalCount > 0
                ? `지금까지 ${String(challengeQuery.data.totalCount)}명이 도전했어요.`
                : '오늘 첫 도전자가 되어보세요.'}
            </p>
          ) : null}
        </>
      )}

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()}{' '}
          <Link to="/about" className="text-linkle font-semibold underline">
            Linkle
          </Link>
          . All rights reserved.
        </p>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </main>
  );
}

interface ClearedSummaryProps {
  dayNumber: number;
  moveCount: number;
  timeSec: number | null;
  rank: number | null;
  emojiResult: string | null;
}

function ClearedSummary({
  dayNumber,
  moveCount,
  timeSec,
  rank,
  emojiResult,
}: ClearedSummaryProps): JSX.Element {
  return (
    <div className="mt-8 flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-foreground text-lg font-semibold">
          {dayNumber}번째 링클을 클리어했습니다!
        </p>
        {rank !== null ? (
          <p className="text-muted-foreground text-sm">
            일일 순위 <span className="text-linkle font-semibold">{rank}</span>등
          </p>
        ) : null}
      </div>

      <dl className="grid w-full max-w-xs grid-cols-2 gap-3">
        <Stat label="소요 시간" value={formatSeconds(timeSec)} />
        <Stat label="이동 횟수" value={`${String(moveCount)}회`} />
      </dl>

      {emojiResult ? (
        <div className="border-border bg-card w-full rounded-xl border px-4 py-4">
          <EmojiSquareLine result={emojiResult} />
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          경로 분석을 준비 중이에요. 잠시 후 새로고침하면 이모지 배열이 표시돼요.
        </p>
      )}

      <div className="flex w-full gap-2">
        <Button asChild block variant="outline">
          <Link to="/play/done">결과 자세히</Link>
        </Button>
        <Button asChild block>
          <Link to="/ranking">오늘 랭킹</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className="bg-muted flex flex-col items-center rounded-md px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground font-mono text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatSeconds(timeSec: number | null): string {
  if (timeSec === null) return '—';
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, Navigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Check, Copy, Share2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PathTrail,
  cn,
  tokens,
  type PathTrailEntry,
} from '@linkle/design-system';
import { challengeDayNumber, getKstToday, type LocalDailyState } from '@linkle/shared';
import { loadLocalDailyState } from '../lib/localDailyStore.js';
import { AppShell } from '../components/AppShell.js';

export function DonePage(): JSX.Element {
  const today = getKstToday();
  const saved = loadLocalDailyState(today);
  if (saved?.status !== 'completed') return <Navigate replace to="/" />;
  return <DoneScreen saved={saved} today={today} />;
}

interface DoneScreenProps {
  readonly today: string;
  readonly saved: LocalDailyState;
}

function DoneScreen({ saved, today }: DoneScreenProps): JSX.Element {
  const dayNumber = challengeDayNumber(today);
  const trail: PathTrailEntry[] = useMemo(
    () =>
      saved.path.map((p) =>
        p.type === 'back' ? { type: 'back' } : { type: 'page', title: p.title },
      ),
    [saved.path],
  );

  // Confetti — tasteful single burst; short, respects reduced-motion.
  const burstedRef = useRef(false);
  useEffect(() => {
    if (burstedRef.current) return;
    burstedRef.current = true;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const timer = window.setTimeout(() => {
      void confetti({
        particleCount: 110,
        spread: 70,
        startVelocity: 36,
        origin: { x: 0.5, y: 0.25 },
        colors: [tokens.colors.linkle, '#83A7EF', '#CCDCF8', tokens.colors.foreground],
        scalar: 0.9,
        ticks: 160,
        disableForReducedMotion: true,
      });
    }, 180);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <AppShell>
      <Hero rank={saved.rank} dayNumber={dayNumber} />

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-7">
            <StatRow moveCount={saved.moveCount} timeSec={saved.timeSec} />
            <div aria-live="polite" className="min-h-[3rem] w-full">
              {saved.emojiResult ? (
                <AnimatedEmojiStrip result={saved.emojiResult} />
              ) : (
                <PendingEmoji />
              )}
            </div>
            <ShareButton
              dayNumber={dayNumber}
              moveCount={saved.moveCount}
              timeSec={saved.timeSec}
              rank={saved.rank}
              emojiResult={saved.emojiResult}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이동 경로</CardTitle>
          </CardHeader>
          <CardContent>
            <PathTrail path={trail} highlightGoal />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button asChild block variant="outline">
            <Link to="/">홈</Link>
          </Button>
          <Button asChild block>
            <Link to="/ranking">오늘 랭킹</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

function Hero({
  rank,
  dayNumber,
}: {
  readonly rank: number | null;
  readonly dayNumber: number;
}): JSX.Element {
  return (
    <section className="mb-8 flex flex-col items-center gap-3 text-center [animation:linkle-fade-slide_480ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
      <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
        #{String(dayNumber).padStart(3, '0')}
      </p>
      <h1 className="text-foreground font-serif text-4xl font-normal sm:text-5xl">도착했어요</h1>
      {rank !== null ? (
        <p className="text-muted-foreground text-sm">
          오늘의 <span className="text-linkle font-semibold">{rank}번째</span> 도착
        </p>
      ) : null}
    </section>
  );
}

// ─── Stat row ────────────────────────────────────────────────────────────

function StatRow({
  moveCount,
  timeSec,
}: {
  readonly moveCount: number;
  readonly timeSec: number | null;
}): JSX.Element {
  return (
    <dl className="flex w-full items-stretch justify-center gap-8">
      <StatBlock label="이동 횟수" value={String(moveCount)} suffix="회" />
      <Divider />
      <StatBlock label="소요 시간" value={formatSeconds(timeSec)} />
    </dl>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  readonly label: string;
  readonly value: string;
  readonly suffix?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1">
      <dt className="text-muted-foreground font-mono text-[11px] uppercase tracking-widest">
        {label}
      </dt>
      <dd className="text-foreground flex items-baseline gap-1">
        <span className="font-serif text-4xl font-normal tabular-nums tracking-tight sm:text-5xl">
          {value}
        </span>
        {suffix ? (
          <span className="text-muted-foreground text-sm font-medium">{suffix}</span>
        ) : null}
      </dd>
    </div>
  );
}

function Divider(): JSX.Element {
  return <span aria-hidden className="bg-border w-px self-stretch" />;
}

// ─── Emoji strip with staggered pop-in ───────────────────────────────────

function AnimatedEmojiStrip({ result }: { readonly result: string }): JSX.Element {
  // Split by Unicode codepoints so multi-byte emoji (🟦 🏁 ⏪) stay intact.
  const squares = useMemo(() => Array.from(result), [result]);
  return (
    <p
      role="img"
      aria-label="경로 유사도 요약"
      className="flex flex-wrap justify-center gap-1 text-center font-mono text-2xl leading-snug"
    >
      {squares.map((char, i) => (
        <span
          key={`${char}-${String(i)}`}
          className="inline-block [animation:linkle-pop_380ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
          style={{ animationDelay: `${String(i * 50)}ms` }}
        >
          {char}
        </span>
      ))}
    </p>
  );
}

function PendingEmoji(): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-1 font-mono text-2xl leading-snug opacity-70">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="bg-muted inline-block size-6 rounded-sm [animation:linkle-pulse_1200ms_ease-in-out_infinite]"
          style={{ animationDelay: `${String(i * 120)}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Share ───────────────────────────────────────────────────────────────

function ShareButton({
  dayNumber,
  moveCount,
  timeSec,
  rank,
  emojiResult,
}: {
  readonly dayNumber: number;
  readonly moveCount: number;
  readonly timeSec: number | null;
  readonly rank: number | null;
  readonly emojiResult: string | null;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  const shareText = useMemo(
    () => buildShareText({ dayNumber, moveCount, timeSec, rank, emojiResult }),
    [dayNumber, moveCount, timeSec, rank, emojiResult],
  );

  const handleClick = async (): Promise<void> => {
    try {
      if (canWebShare && navigator.canShare({ text: shareText })) {
        await navigator.share({ text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      // User-cancelled or clipboard blocked — no-op is fine.
    }
  };

  const Icon = copied ? Check : canWebShare ? Share2 : Copy;
  const label = copied ? '복사됨' : canWebShare ? '공유하기' : '결과 복사';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleClick()}
      disabled={!emojiResult}
      aria-live="polite"
    >
      <Icon aria-hidden />
      <span className={cn(copied && 'text-linkle font-semibold')}>{label}</span>
    </Button>
  );
}

function buildShareText(args: {
  dayNumber: number;
  moveCount: number;
  timeSec: number | null;
  rank: number | null;
  emojiResult: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`#${String(args.dayNumber)} 링클 클리어!`);
  if (args.rank !== null) lines.push(`일일 순위 ${String(args.rank)}등`);
  lines.push(`이동 ${String(args.moveCount)}회 · 시간 ${formatSeconds(args.timeSec)}`);
  if (args.emojiResult) {
    lines.push('');
    lines.push(args.emojiResult);
  }
  lines.push('');
  lines.push('https://linkle.kr');
  return lines.join('\n');
}

function formatSeconds(timeSec: number | null): string {
  if (timeSec === null) return '—';
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import type { JSX } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmojiSquareLine,
  PageShell,
  PathTrail,
  type PathTrailEntry,
} from '@linkle/design-system';
import { getKstToday } from '@linkle/shared';
import { loadLocalDailyState } from '../lib/localDailyStore.js';

export function DonePage(): JSX.Element {
  const today = getKstToday();
  const saved = loadLocalDailyState(today);
  if (saved?.status !== 'completed') return <Navigate replace to="/" />;

  const trail: PathTrailEntry[] = saved.path.map((p) =>
    p.type === 'back' ? { type: 'back' } : { type: 'page', title: p.title },
  );

  return (
    <PageShell>
      <header className="flex flex-col gap-2 text-center">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">{today}</p>
        <h1 className="text-foreground font-serif text-3xl">도착했어요 🎉</h1>
        {saved.rank !== null ? (
          <Badge variant="muted" className="mx-auto">
            오늘의 <strong className="mx-1">{saved.rank}번째</strong> 도착
          </Badge>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>결과</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="이동" value={`${String(saved.moveCount)}회`} />
            <Stat label="시간" value={formatSeconds(saved.timeSec)} />
          </dl>
          {saved.emojiResult ? (
            <EmojiSquareLine result={saved.emojiResult} />
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              경로 유사도를 계산하는 중이에요. 잠시 후 홈에서 다시 확인해주세요.
            </p>
          )}
          <section aria-label="이동 경로">
            <PathTrail path={trail} highlightGoal />
          </section>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild block variant="outline">
          <Link to="/">홈으로</Link>
        </Button>
        <Button asChild block>
          <Link to="/ranking">랭킹 보러가기</Link>
        </Button>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
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

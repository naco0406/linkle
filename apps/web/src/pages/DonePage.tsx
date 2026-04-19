import type { JSX } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmojiSquareLine,
  PathTrail,
  type PathTrailEntry,
} from '@linkle/design-system';
import { getKstToday } from '@linkle/shared';
import { loadLocalDailyState } from '../lib/localDailyStore.js';
import { AppShell } from '../components/AppShell.js';

export function DonePage(): JSX.Element {
  const today = getKstToday();
  const saved = loadLocalDailyState(today);
  if (saved?.status !== 'completed') return <Navigate replace to="/" />;

  const trail: PathTrailEntry[] = saved.path.map((p) =>
    p.type === 'back' ? { type: 'back' } : { type: 'page', title: p.title },
  );

  return (
    <AppShell>
      <section className="mb-6 flex flex-col items-center gap-2 text-center">
        <p className="text-muted-foreground text-sm">{today}</p>
        <h1 className="text-foreground font-serif text-3xl font-normal sm:text-4xl">도착했어요</h1>
        <p className="text-muted-foreground text-sm">
          {saved.rank !== null ? (
            <>
              오늘의 <span className="text-linkle font-semibold">{saved.rank}번째</span> 도착
            </>
          ) : (
            '오늘의 결과를 저장했어요.'
          )}
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <dl className="flex items-baseline gap-8 font-mono tabular-nums">
              <Stat label="이동" value={`${String(saved.moveCount)}회`} />
              <Stat label="시간" value={formatSeconds(saved.timeSec)} />
            </dl>
            {saved.emojiResult ? (
              <EmojiSquareLine result={saved.emojiResult} />
            ) : (
              <p className="text-muted-foreground text-xs">
                경로 유사도를 계산 중이에요. 잠시 후 다시 확인해주세요.
              </p>
            )}
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

function Stat({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">{label}</dt>
      <dd className="text-foreground text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function formatSeconds(timeSec: number | null): string {
  if (timeSec === null) return '—';
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

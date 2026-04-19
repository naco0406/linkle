import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmojiSquareLine,
  PathTrail,
  type PathTrailEntry,
} from '@linkle/design-system';
import { ArrowRight } from 'lucide-react';
import { getKstYesterday } from '@linkle/shared';
import { fetchStatistics } from '../lib/api.js';
import { AppShell } from '../components/AppShell.js';
import { PageTitle } from '../components/PageTitle.js';

export function YesterdayPage(): JSX.Element {
  const yesterday = getKstYesterday();
  const q = useQuery({
    queryKey: ['statistics', yesterday],
    queryFn: () => fetchStatistics(yesterday),
    retry: false,
  });

  return (
    <AppShell>
      <PageTitle title="어제의 링클" subtitle={yesterday} />

      {q.isLoading ? (
        <Card aria-busy="true">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            불러오는 중…
          </CardContent>
        </Card>
      ) : q.data ? (
        <div className="flex flex-col gap-4">
          <ChallengeHero
            startPage={q.data.startPage}
            endPage={q.data.endPage}
            totalCount={q.data.totalCount}
          />
          {q.data.shortestPath ? (
            <Card>
              <CardHeader>
                <CardTitle>최단 경로</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-muted-foreground text-sm">
                  <strong className="text-foreground">{q.data.shortestPath.nickname}</strong> · 이동{' '}
                  {q.data.shortestPath.moveCount}회
                </p>
                {q.data.shortestPath.emojiResult ? (
                  <EmojiSquareLine result={q.data.shortestPath.emojiResult} />
                ) : null}
                <PathTrail path={toTrail(q.data.shortestPath.path)} highlightGoal />
              </CardContent>
            </Card>
          ) : null}
          {q.data.fastestTime ? (
            <Card>
              <CardHeader>
                <CardTitle>가장 빠른 완주</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <strong className="text-foreground">{q.data.fastestTime.nickname}</strong>{' '}
                  <span className="text-muted-foreground">·</span>{' '}
                  <span className="text-linkle font-mono font-semibold tabular-nums">
                    {formatSeconds(q.data.fastestTime.timeSec)}
                  </span>
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            어제의 기록을 찾을 수 없어요.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function ChallengeHero({
  startPage,
  endPage,
  totalCount,
}: {
  readonly startPage: string;
  readonly endPage: string;
  readonly totalCount: number;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex items-center gap-3 text-base font-semibold md:text-lg">
          <span className="min-w-0 flex-1 truncate text-right" title={startPage}>
            {startPage}
          </span>
          <ArrowRight size={18} aria-hidden className="text-linkle shrink-0" />
          <span className="text-linkle min-w-0 flex-1 truncate" title={endPage}>
            {endPage}
          </span>
        </div>
        {totalCount > 0 ? (
          <p className="text-muted-foreground text-center text-xs">
            총 <strong className="text-foreground">{totalCount}명</strong>이 도착했어요.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function toTrail(path: readonly { type: 'page' | 'back'; title?: string }[]): PathTrailEntry[] {
  return path.map((p) =>
    p.type === 'back' ? { type: 'back' } : { type: 'page', title: p.title ?? '' },
  );
}

function formatSeconds(timeSec: number): string {
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

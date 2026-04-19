import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChallengeCard,
  EmojiSquareLine,
  PathTrail,
  SubPageHeader,
  type PathTrailEntry,
} from '@linkle/design-system';
import { getKstYesterday } from '@linkle/shared';
import { fetchStatistics } from '../lib/api.js';

export function YesterdayPage(): JSX.Element {
  const yesterday = getKstYesterday();
  const q = useQuery({
    queryKey: ['statistics', yesterday],
    queryFn: () => fetchStatistics(yesterday),
    retry: false,
  });

  return (
    <>
      <SubPageHeader title="어제의 링클" subtitle={yesterday} />
      <main className="max-w-shell mx-auto flex w-full flex-col gap-4 px-4 py-6 md:px-6">
        {q.isLoading ? (
          <Card aria-busy="true">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              불러오는 중…
            </CardContent>
          </Card>
        ) : q.data ? (
          <>
            <ChallengeCard
              date={q.data.challengeDate}
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
                    <strong className="text-foreground">{q.data.shortestPath.nickname}</strong> ·
                    이동 {q.data.shortestPath.moveCount}회
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
                  <p className="text-muted-foreground text-sm">
                    <strong className="text-foreground">{q.data.fastestTime.nickname}</strong> ·{' '}
                    {formatSeconds(q.data.fastestTime.timeSec)}
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              어제의 기록을 찾을 수 없어요.
            </CardContent>
          </Card>
        )}
      </main>
    </>
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

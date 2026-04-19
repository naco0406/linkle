import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '@linkle/design-system';
import { getKstToday, type Ranking, type RankingSort } from '@linkle/shared';
import { fetchRankings } from '../lib/api.js';
import { AppShell } from '../components/AppShell.js';
import { PageTitle } from '../components/PageTitle.js';

const SORT_TABS: { value: RankingSort; label: string }[] = [
  { value: 'fastest', label: '빠른 시간' },
  { value: 'leastClicks', label: '적은 클릭' },
  { value: 'firstToFinish', label: '먼저 도착' },
];

export function RankingPage(): JSX.Element {
  const today = getKstToday();
  const [sort, setSort] = useState<RankingSort>('fastest');
  const q = useQuery({
    queryKey: ['rankings', today, sort],
    queryFn: () => fetchRankings(today, sort, 10),
  });

  return (
    <AppShell>
      <PageTitle title="랭킹" subtitle={`${today} · 오늘의 도전자`} />

      <Tabs
        value={sort}
        onValueChange={(v) => {
          setSort(v as RankingSort);
        }}
      >
        <TabsList>
          {SORT_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SORT_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <RankingTable rankings={q.data ?? []} loading={q.isLoading} sort={t.value} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function RankingTable({
  rankings,
  loading,
  sort,
}: {
  rankings: Ranking[];
  loading: boolean;
  sort: RankingSort;
}): JSX.Element {
  if (loading) {
    return (
      <Card aria-busy="true">
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          불러오는 중…
        </CardContent>
      </Card>
    );
  }
  if (rankings.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          아직 기록이 없어요. 가장 먼저 도착해보세요.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-0">
        <ol className="divide-border divide-y">
          {rankings.map((r, idx) => (
            <li
              key={r.id}
              className={cn(
                '-mx-1 flex items-center gap-3 rounded-md px-1 py-3',
                'hover:bg-muted/40 transition-colors',
              )}
            >
              <RankingBadge rank={idx + 1} />
              <span className="flex-1 truncate font-semibold">{r.nickname}</span>
              <span className="text-foreground font-mono text-sm tabular-nums">
                {sort === 'leastClicks' ? `${String(r.moveCount)}회` : formatSeconds(r.timeSec)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function RankingBadge({ rank }: { readonly rank: number }): JSX.Element {
  if (rank === 1 || rank === 2 || rank === 3) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    return (
      <span
        aria-label={`${String(rank)}위`}
        className="inline-flex w-6 justify-center text-base leading-none"
      >
        {medal}
      </span>
    );
  }
  return <span className="text-muted-foreground w-6 text-center font-mono text-sm">{rank}</span>;
}

function formatSeconds(timeSec: number): string {
  const m = Math.floor(timeSec / 60);
  const s = timeSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

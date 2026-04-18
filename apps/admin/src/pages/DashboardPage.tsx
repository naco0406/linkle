import { useMemo, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@linkle/design-system';
import { getKstToday } from '@linkle/shared';
import { listChallenges } from '../lib/api.js';

/**
 * At-a-glance dashboard: list the next 30 days of challenges, flagging which
 * dates are empty. Editing a row links to the per-date editor.
 */
export function DashboardPage(): JSX.Element {
  const today = getKstToday();
  const { from, to } = useMemo(() => calcRange(today, 30), [today]);
  const q = useQuery({
    queryKey: ['admin', 'challenges', from, to],
    queryFn: () => listChallenges(from, to),
  });

  const rowByDate = new Map((q.data ?? []).map((c) => [c.date, c]));
  const dates = useMemo(() => enumerateDates(from, to), [from, to]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-serif text-2xl">챌린지 캘린더</h1>
        <p className="text-muted-foreground text-sm">오늘부터 30일 뒤까지의 챌린지를 관리합니다.</p>
      </header>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {from} ~ {to}
          </CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to={`/challenges/${today}`}>오늘 챌린지 편집</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-border divide-y">
            {dates.map((d) => {
              const row = rowByDate.get(d);
              return (
                <li key={d} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-muted-foreground w-28 font-mono text-sm">{d}</span>
                  {row ? (
                    <>
                      <span className="flex-1 truncate text-sm">
                        <strong>{row.startPage}</strong>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="text-linkle">{row.endPage}</span>
                      </span>
                      <Badge variant="muted">{row.totalCount}명</Badge>
                    </>
                  ) : (
                    <span className="text-muted-foreground flex-1 text-sm">비어 있음</span>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/challenges/${d}`}>편집</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function calcRange(today: string, days: number): { from: string; to: string } {
  const startMs = Date.parse(`${today}T00:00:00+09:00`);
  const toMs = startMs + days * 24 * 60 * 60 * 1000;
  return { from: today, to: formatKst(toMs) };
}

function enumerateDates(from: string, to: string): string[] {
  const startMs = Date.parse(`${from}T00:00:00+09:00`);
  const endMs = Date.parse(`${to}T00:00:00+09:00`);
  const out: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
    out.push(formatKst(ms));
  }
  return out;
}

function formatKst(ms: number): string {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

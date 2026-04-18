import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChallengeCard,
  EmojiSquareLine,
  PageShell,
} from '@linkle/design-system';
import { challengeDayNumber, getKstToday } from '@linkle/shared';
import { fetchTodayChallenge } from '../lib/api.js';
import { loadLocalDailyState } from '../lib/localDailyStore.js';

export function HomePage(): JSX.Element {
  const today = getKstToday();
  const savedState = loadLocalDailyState(today);
  const challengeQuery = useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: fetchTodayChallenge,
  });

  const dayNumber = challengeDayNumber(today);
  const alreadyCompleted = savedState?.status === 'completed';

  return (
    <PageShell>
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          #{String(dayNumber).padStart(3, '0')} · {today}
        </p>
        <h1 className="text-foreground font-serif text-3xl">
          오늘의 <span className="text-linkle">링클</span>
        </h1>
      </header>

      {challengeQuery.isLoading ? (
        <Card aria-busy="true">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            오늘의 챌린지를 불러오는 중…
          </CardContent>
        </Card>
      ) : challengeQuery.data ? (
        <ChallengeCard
          startPage={challengeQuery.data.startPage}
          endPage={challengeQuery.data.endPage}
          totalCount={challengeQuery.data.totalCount}
        />
      ) : (
        <Card role="alert">
          <CardContent className="text-destructive py-10 text-center text-sm">
            오늘의 챌린지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </CardContent>
        </Card>
      )}

      {alreadyCompleted ? (
        <Card>
          <CardHeader>
            <CardTitle>오늘의 결과</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {savedState.emojiResult ? (
              <EmojiSquareLine result={savedState.emojiResult} />
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                경로 분석을 준비 중이에요.
              </p>
            )}
            <div className="flex gap-2">
              <Button asChild block variant="outline">
                <Link to="/play/done">결과 상세</Link>
              </Button>
              <Button asChild block>
                <Link to="/ranking">오늘 랭킹 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          asChild
          size="lg"
          block
          disabled={!challengeQuery.data}
          aria-disabled={!challengeQuery.data}
        >
          <Link to="/play">지금 시작하기</Link>
        </Button>
      )}
    </PageShell>
  );
}

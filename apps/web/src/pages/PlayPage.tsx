import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  ForcedEndPanel,
  PageShell,
  PathTrail,
  TimerPill,
  type PathTrailEntry,
} from '@linkle/design-system';
import {
  fetchWikiPage,
  formatPageTitle,
  isEndPage,
  parseLinkHref,
  getKstToday,
  type Path,
  type PathEntry,
} from '@linkle/shared';
import { sanitizeWikipediaHtml } from '@linkle/shared/sanitize';
import { useGameStore } from '../game/gameStore.js';
import { useElapsedMs } from '../game/useTimer.js';
import { useSearchGuard } from '../game/useSearchGuard.js';
import { fetchTodayChallenge, submitRanking } from '../lib/api.js';
import { getOrCreateIdentity } from '../lib/userIdentity.js';
import { loadLocalDailyState, saveLocalDailyState } from '../lib/localDailyStore.js';

export function PlayPage(): JSX.Element {
  const navigate = useNavigate();
  const today = getKstToday();
  const challenge = useGameStore((s) => s.challenge);
  const status = useGameStore((s) => s.status);
  const currentHtml = useGameStore((s) => s.currentHtml);
  const loadChallenge = useGameStore((s) => s.loadChallenge);
  const onFirstPageLoaded = useGameStore((s) => s.onFirstPageLoaded);
  const onPageLoaded = useGameStore((s) => s.onPageLoaded);
  const visitPage = useGameStore((s) => s.visitPage);
  const goBack = useGameStore((s) => s.goBack);
  const forceEndDueToSearch = useGameStore((s) => s.forceEndDueToSearch);
  const beginSubmit = useGameStore((s) => s.beginSubmit);
  const onSubmitted = useGameStore((s) => s.onSubmitted);
  const rehydrate = useGameStore((s) => s.rehydrate);

  const challengeQuery = useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: fetchTodayChallenge,
  });

  // Elapsed time — hook must not be conditional, so compute outside any guard.
  const startedAtForTimer = status.kind === 'playing' ? status.startedAt : null;
  const timerRunning = status.kind === 'playing';
  const elapsed = useElapsedMs(startedAtForTimer, timerRunning);

  // Bootstrap once after challenge resolves.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    if (!challengeQuery.data) return;
    bootstrapped.current = true;
    loadChallenge(challengeQuery.data);

    const saved = loadLocalDailyState(today);
    if (saved?.status === 'playing' && saved.startedAtMs !== null) {
      rehydrate({
        challenge: challengeQuery.data,
        path: saved.path,
        moveCount: saved.moveCount,
        startedAtMs: saved.startedAtMs,
      });
    }
  }, [challengeQuery.data, loadChallenge, rehydrate, today]);

  // When challenge is set, fetch the start page via TanStack Query so
  // StrictMode's double-invocation does not leave us stuck in 'loading'.
  const startPageQuery = useQuery({
    queryKey: ['wiki', 'start', challenge?.startPage ?? ''],
    queryFn: async () => {
      if (!challenge) throw new Error('no challenge');
      return fetchWikiPage(challenge.startPage);
    },
    enabled: challenge !== null,
  });
  useEffect(() => {
    if (status.kind !== 'idle') return;
    if (!startPageQuery.data) return;
    onFirstPageLoaded(sanitizeWikipediaHtml(startPageQuery.data.html), startPageQuery.data.title);
  }, [status.kind, startPageQuery.data, onFirstPageLoaded]);

  // Persist state every time it changes meaningfully.
  useEffect(() => {
    if (status.kind !== 'playing' || !challenge) return;
    const identity = getOrCreateIdentity();
    saveLocalDailyState({
      date: today,
      userId: identity.userId,
      nickname: identity.nickname,
      path: status.path,
      moveCount: status.moveCount,
      startedAtMs: status.startedAt,
      finishedAtMs: null,
      timeSec: null,
      status: 'playing',
      emojiResult: null,
      rank: null,
    });
  }, [status, challenge, today]);

  // Forced end hotkey.
  useSearchGuard(
    useCallback(() => {
      forceEndDueToSearch();
    }, [forceEndDueToSearch]),
  );

  const submitMutation = useMutation({
    mutationFn: submitRanking,
    onSuccess: (res, variables) => {
      onSubmitted({ rank: res.rank, emojiResult: null });
      const identity = getOrCreateIdentity();
      saveLocalDailyState({
        date: today,
        userId: identity.userId,
        nickname: identity.nickname,
        path: variables.path,
        moveCount: variables.moveCount,
        startedAtMs: null,
        finishedAtMs: Date.now(),
        timeSec: variables.timeSec,
        status: 'completed',
        emojiResult: null,
        rank: res.rank,
      });
      void navigate('/play/done', { replace: true });
    },
  });

  const submitIfReachedGoal = useCallback(
    (finalPath: Path, finalMoveCount: number, startedAt: number) => {
      const timeSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      beginSubmit(timeSec);
      const identity = getOrCreateIdentity();
      submitMutation.mutate({
        challengeDate: today,
        userId: identity.userId,
        nickname: identity.nickname,
        moveCount: finalMoveCount,
        timeSec,
        path: finalPath,
      });
    },
    [beginSubmit, submitMutation, today],
  );

  const contentRef = useRef<HTMLElement | null>(null);
  const handleContentClick = useCallback(
    async (ev: React.MouseEvent<HTMLElement>) => {
      const s = useGameStore.getState();
      if (s.status.kind !== 'playing' || !s.challenge) return;
      const target = ev.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      const raw = parseLinkHref(href);
      if (!raw) return;
      ev.preventDefault();

      const title = formatPageTitle(raw);
      const { reachedGoal } = visitPage(title);

      if (reachedGoal) {
        const postState = useGameStore.getState();
        if (postState.status.kind === 'playing') {
          submitIfReachedGoal(
            postState.status.path,
            postState.status.moveCount,
            postState.status.startedAt,
          );
        }
        return;
      }

      try {
        const page = await fetchWikiPage(raw);
        onPageLoaded(sanitizeWikipediaHtml(page.html), page.title);
        contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      } catch (err) {
        console.error('failed to load next page', err);
      }
    },
    [visitPage, onPageLoaded, submitIfReachedGoal],
  );

  // Defensive: if user comes back here with completed state, bounce to done.
  useEffect(() => {
    if (status.kind === 'completed') {
      void navigate('/play/done', { replace: true });
    }
  }, [status.kind, navigate]);

  // Store bootstraps asynchronously after Query settles. Treat "query is still
  // fetching OR data exists but store hasn't absorbed it yet" as the loading
  // state; only redirect home once we're certain there's no challenge at all.
  if (!challenge) {
    if (challengeQuery.isLoading || challengeQuery.data) {
      return (
        <PageShell>
          <p className="text-muted-foreground text-sm">챌린지를 불러오는 중…</p>
        </PageShell>
      );
    }
    return <Navigate replace to="/" />;
  }

  if (status.kind === 'forcedEnd') {
    return (
      <PageShell>
        <ForcedEndPanel
          reason="게임 중 '페이지에서 찾기' 단축키가 감지되어 종료되었습니다."
          action={
            <Button asChild variant="outline">
              <Link to="/">홈으로 돌아가기</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const trail = toTrailEntries(status);

  return (
    <PageShell
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 truncate">
            <p className="text-muted-foreground text-xs">목표</p>
            <p className="text-linkle truncate text-base font-semibold">{challenge.endPage}</p>
          </div>
          <TimerPill elapsedMs={elapsed} active={timerRunning} />
        </div>
      }
    >
      <section aria-label="진행 경로" className="border-border bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">이동 {statusMoveCount(status)}회</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={goBack}
            disabled={status.kind !== 'playing' || !canGoBack(status.path)}
          >
            뒤로가기
          </Button>
        </div>
        <PathTrail className="mt-2" path={trail} highlightGoal />
      </section>

      {/* Event delegation on the article intercepts clicks on inner <a>
          elements. Keyboard users activate those anchors natively via Enter,
          so no separate key handler is needed on the article itself. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <article
        ref={contentRef}
        aria-label="위키피디아 본문"
        onClick={(e) => {
          void handleContentClick(e);
        }}
        className="wiki-body linkle-no-select border-border bg-card max-h-[60dvh] overflow-auto rounded-xl border p-4 text-[0.95rem] leading-relaxed"
      >
        {status.kind === 'loading' || !currentHtml ? (
          <p className="text-muted-foreground py-10 text-center text-sm">페이지를 불러오는 중…</p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: currentHtml }} />
        )}
      </article>
    </PageShell>
  );
}

function canGoBack(path: readonly PathEntry[]): boolean {
  const pages = path.filter((p) => p.type === 'page');
  return pages.length >= 2;
}

function statusMoveCount(status: ReturnType<typeof useGameStore.getState>['status']): number {
  return status.kind === 'playing' || status.kind === 'submitting' || status.kind === 'completed'
    ? status.moveCount
    : 0;
}

function toTrailEntries(
  status: ReturnType<typeof useGameStore.getState>['status'],
): PathTrailEntry[] {
  if (status.kind !== 'playing' && status.kind !== 'submitting' && status.kind !== 'completed') {
    return [];
  }
  return status.path.map((p) =>
    p.type === 'back' ? { type: 'back' } : { type: 'page', title: p.title },
  );
}

// Silence unused-import lint when isEndPage lives in the store only.
void isEndPage;

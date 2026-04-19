import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, ForcedEndPanel, HelpDialog, cn } from '@linkle/design-system';
import { ArrowLeft, CircleHelp, Loader2, TriangleAlert } from 'lucide-react';
import {
  fetchWikiPage,
  formatPageTitle,
  parseLinkHref,
  getKstToday,
  type Path,
} from '@linkle/shared';
import { sanitizeWikipediaHtml } from '@linkle/shared/sanitize';
import {
  selectCanGoBack,
  selectCurrentTitle,
  selectMoveCount,
  selectPreviousPageTitle,
  useGameStore,
} from '../game/gameStore.js';
import { useElapsedMs } from '../game/useTimer.js';
import { useSearchGuard } from '../game/useSearchGuard.js';
import { fetchTodayChallenge, submitRanking } from '../lib/api.js';
import { getOrCreateIdentity } from '../lib/userIdentity.js';
import { loadLocalDailyState, saveLocalDailyState } from '../lib/localDailyStore.js';

/**
 * Game play surface.
 *
 * State architecture (see gameStore.ts for the contract):
 *   - `useGameStore`   — domain state only (path, moveCount, phase, timer anchor)
 *   - `challengeQuery` — TanStack Query: today's challenge from the Worker
 *   - `pageQuery`      — TanStack Query: the *current* Wikipedia article,
 *                        keyed on `selectCurrentTitle(status)`. Every visit()
 *                        or goBack() mutation rekeys the query, which means
 *                        there is no imperative "now fetch the new page"
 *                        useEffect to race.
 *
 * Browser Back history mirrors the wiki stack: each visit pushes a history
 * entry tagged with depth so the native Back button pops the wiki stack
 * (via goBack) until the player is at depth 1 and falls through to /.
 */
export function PlayPage(): JSX.Element {
  const navigate = useNavigate();
  const today = getKstToday();

  const challenge = useGameStore((s) => s.challenge);
  const status = useGameStore((s) => s.status);
  const loadChallenge = useGameStore((s) => s.loadChallenge);
  const startFresh = useGameStore((s) => s.startFresh);
  const rehydrate = useGameStore((s) => s.rehydrate);
  const visit = useGameStore((s) => s.visit);
  const goBack = useGameStore((s) => s.goBack);
  const forceEndDueToSearch = useGameStore((s) => s.forceEndDueToSearch);
  const beginSubmit = useGameStore((s) => s.beginSubmit);
  const onSubmitted = useGameStore((s) => s.onSubmitted);

  const [helpOpen, setHelpOpen] = useState(false);

  // ─── server state ─────────────────────────────────────────────────────

  const challengeQuery = useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: fetchTodayChallenge,
  });

  const currentTitle = selectCurrentTitle(status);
  const pageQuery = useQuery({
    queryKey: ['wiki', 'page', currentTitle],
    queryFn: async () => {
      if (!currentTitle) throw new Error('no current title');
      return fetchWikiPage(currentTitle);
    },
    enabled: currentTitle !== null && status.kind === 'playing',
    staleTime: 60 * 60 * 1000, // article content is stable for a session
    retry: 1,
  });

  const sanitizedHtml = useMemo(
    () => (pageQuery.data ? sanitizeWikipediaHtml(pageQuery.data.html) : null),
    [pageQuery.data],
  );

  // ─── bootstrap (idle → playing) ───────────────────────────────────────

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    if (!challengeQuery.data) return;
    bootstrapped.current = true;

    loadChallenge(challengeQuery.data);

    const saved = loadLocalDailyState(today);
    if (saved?.status === 'playing' && saved.startedAtMs !== null && saved.path.length > 0) {
      rehydrate({
        path: saved.path,
        moveCount: saved.moveCount,
        startedAtMs: saved.startedAtMs,
      });
    } else {
      startFresh();
    }
  }, [challengeQuery.data, loadChallenge, rehydrate, startFresh, today]);

  // ─── timer ────────────────────────────────────────────────────────────

  const startedAtForTimer = status.kind === 'playing' ? status.startedAt : null;
  const timerRunning = status.kind === 'playing';
  const elapsedMs = useElapsedMs(startedAtForTimer, timerRunning);

  // ─── in-progress persistence ──────────────────────────────────────────

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

  // ─── hotkey guard ─────────────────────────────────────────────────────

  useSearchGuard(
    useCallback(() => {
      forceEndDueToSearch();
    }, [forceEndDueToSearch]),
  );

  // ─── submission ───────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: submitRanking,
    onSuccess: (res, variables) => {
      onSubmitted({ rank: res.rank, emojiResult: res.emojiResult });
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
        emojiResult: res.emojiResult,
        rank: res.rank,
      });
      void navigate('/play/done', { replace: true });
    },
  });

  const submitIfGoal = useCallback(
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

  // ─── link-click delegation ────────────────────────────────────────────

  const contentRef = useRef<HTMLDivElement | null>(null);
  const handleContentClick = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      const s = useGameStore.getState();
      if (s.status.kind !== 'playing' || !s.challenge) return;

      const target = ev.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const raw = parseLinkHref(anchor.getAttribute('href'));
      if (!raw) return;
      ev.preventDefault();

      const title = formatPageTitle(raw);
      const { reachedGoal } = visit(title);

      if (reachedGoal) {
        const post = useGameStore.getState();
        if (post.status.kind === 'playing') {
          submitIfGoal(post.status.path, post.status.moveCount, post.status.startedAt);
        }
      }
      // Non-goal: pageQuery rekeys on `currentTitle` and fetches automatically.
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [visit, submitIfGoal],
  );

  useEffect(() => {
    if (status.kind === 'completed') {
      void navigate('/play/done', { replace: true });
    }
  }, [status.kind, navigate]);

  // ─── browser history mirroring ────────────────────────────────────────

  const pageDepth = status.kind === 'playing' ? countPages(status.path) : 0;
  const lastPushedDepth = useRef<number | null>(null);
  useEffect(() => {
    if (status.kind !== 'playing') return;
    if (pageDepth <= 1) {
      window.history.replaceState({ linkleWikiDepth: 1 }, '');
      lastPushedDepth.current = 1;
      return;
    }
    if (lastPushedDepth.current !== null && pageDepth > lastPushedDepth.current) {
      window.history.pushState({ linkleWikiDepth: pageDepth }, '');
    } else {
      window.history.replaceState({ linkleWikiDepth: pageDepth }, '');
    }
    lastPushedDepth.current = pageDepth;
  }, [pageDepth, status.kind]);

  useEffect(() => {
    const onPop = (e: PopStateEvent): void => {
      const s = useGameStore.getState();
      if (s.status.kind !== 'playing') return;
      const n = countPages(s.status.path);
      if (n <= 1) return;
      const raw = (e.state as { linkleWikiDepth?: unknown } | null)?.linkleWikiDepth;
      const target = typeof raw === 'number' ? raw : 1;
      if (target < n) goBack();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [goBack]);

  // ─── early returns ────────────────────────────────────────────────────

  if (challengeQuery.isError) {
    return (
      <FullScreenStatus
        tone="error"
        title="오늘의 챌린지를 불러오지 못했어요"
        detail={messageOf(challengeQuery.error)}
        onRetry={() => void challengeQuery.refetch()}
      />
    );
  }

  if (!challenge || status.kind === 'idle') {
    return <FullScreenStatus tone="loading" title="챌린지를 준비하는 중…" />;
  }

  if (status.kind === 'forcedEnd') {
    return (
      <div className="bg-background grid min-h-dvh place-items-center px-4">
        <ForcedEndPanel
          reason="게임 중 '페이지에서 찾기' 단축키가 감지되어 종료되었습니다."
          action={
            <Button asChild variant="outline">
              <a href="/">홈으로 돌아가기</a>
            </Button>
          }
        />
      </div>
    );
  }

  if (status.kind === 'submitting') {
    return (
      <FullScreenStatus
        tone="loading"
        title="결과를 분석하는 중…"
        detail="경로 유사도를 측정하고 있어요."
      />
    );
  }

  const displayTitle = currentTitle ?? challenge.startPage;

  // First fetch still in flight and nothing cached yet → fill the screen.
  if (status.kind === 'playing' && pageQuery.isPending && !sanitizedHtml) {
    return (
      <FullScreenStatus
        tone="loading"
        title="위키피디아 문서를 불러오는 중…"
        detail={`"${displayTitle}" 여는 중`}
      />
    );
  }

  if (status.kind === 'playing' && pageQuery.isError && !sanitizedHtml) {
    return (
      <FullScreenStatus
        tone="error"
        title="위키피디아 문서를 불러오지 못했어요"
        detail={messageOf(pageQuery.error)}
        onRetry={() => void pageQuery.refetch()}
      />
    );
  }

  // ─── render ───────────────────────────────────────────────────────────

  return (
    <div className="bg-background flex h-[100dvh] flex-col">
      <GameHeader
        startPage={challenge.startPage}
        endPage={challenge.endPage}
        previousPageTitle={selectPreviousPageTitle(status)}
        canGoBack={selectCanGoBack(status)}
        onGoBack={goBack}
        onHelp={() => {
          setHelpOpen(true);
        }}
        disabled={false}
      />

      {pageQuery.isError && sanitizedHtml ? (
        <InlineError detail={messageOf(pageQuery.error)} onRetry={() => void pageQuery.refetch()} />
      ) : null}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        ref={contentRef}
        onClick={handleContentClick}
        className={cn(
          'linkle-no-select bg-card flex-grow overflow-auto p-4',
          pageQuery.isFetching && sanitizedHtml ? 'opacity-80' : undefined,
        )}
      >
        {sanitizedHtml ? (
          <div
            className="wiki-content mx-auto max-w-3xl break-words"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            불러오는 중…
          </div>
        )}
      </div>

      <GameFooter
        currentTitle={displayTitle}
        elapsedMs={elapsedMs}
        moveCount={selectMoveCount(status)}
        fetchingBackground={pageQuery.isFetching && !!sanitizedHtml}
      />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

// ─── chrome ───────────────────────────────────────────────────────────────

interface GameHeaderProps {
  startPage: string;
  endPage: string;
  previousPageTitle: string | null;
  canGoBack: boolean;
  onGoBack: () => void;
  onHelp: () => void;
  disabled: boolean;
}

function GameHeader({
  startPage,
  endPage,
  previousPageTitle,
  canGoBack,
  onGoBack,
  onHelp,
  disabled,
}: GameHeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-2',
        'border-border bg-background border-b',
        'h-[60px] px-4 md:h-[80px] md:px-6',
      )}
    >
      <button
        type="button"
        onClick={onGoBack}
        disabled={!canGoBack || disabled}
        aria-label="뒤로가기"
        className={cn(
          'text-foreground inline-flex items-center gap-2 rounded-md px-2 py-1',
          'hover:bg-muted transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <ArrowLeft size={22} />
        {previousPageTitle ? (
          <span className="hidden max-w-[12rem] truncate text-[20px] font-normal md:inline">
            {previousPageTitle}
          </span>
        ) : null}
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="text-foreground truncate text-[18px] font-normal md:text-[24px]">
          <span className="text-foreground/70">목표: </span>
          <span className="text-linkle hidden font-semibold md:inline">{startPage}</span>
          <span aria-hidden className="text-foreground/70 hidden md:inline">
            {' → '}
          </span>
          <span className="text-linkle font-semibold">{endPage}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onHelp}
        aria-label="게임 규칙 보기"
        className={cn(
          'text-foreground inline-flex size-10 items-center justify-center rounded-md',
          'hover:bg-muted transition-colors',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <CircleHelp size={22} />
      </button>
    </header>
  );
}

interface GameFooterProps {
  currentTitle: string;
  elapsedMs: number;
  moveCount: number;
  fetchingBackground: boolean;
}

function GameFooter({
  currentTitle,
  elapsedMs,
  moveCount,
  fetchingBackground,
}: GameFooterProps): JSX.Element {
  return (
    <footer
      className={cn(
        'border-border bg-background shrink-0 border-t',
        'px-4 py-3 md:px-6 md:py-5',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      )}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="min-w-0 truncate text-[15px] md:text-[20px]">
          <span className="text-foreground/70">현재 문서: </span>
          <span className="text-linkle font-semibold">{currentTitle}</span>
          {fetchingBackground ? (
            <Loader2
              className="text-muted-foreground ml-2 inline size-3 animate-spin"
              aria-hidden
            />
          ) : null}
        </p>
        <div className="flex items-center justify-between gap-4 md:justify-end">
          <p className="text-[15px] md:text-[20px]">
            <span className="text-foreground/70">소요 시간: </span>
            <span className="text-linkle font-mono font-semibold tabular-nums">
              {formatElapsed(elapsedMs)}
            </span>
          </p>
          <p className="text-[15px] md:text-[20px]">
            <span className="text-foreground/70">이동 횟수: </span>
            <span className="text-linkle font-mono font-semibold tabular-nums">{moveCount}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── full-screen + inline status ─────────────────────────────────────────

interface FullScreenStatusProps {
  tone: 'loading' | 'error';
  title: string;
  detail?: string;
  onRetry?: () => void;
}

function FullScreenStatus({ tone, title, detail, onRetry }: FullScreenStatusProps): JSX.Element {
  const Icon = tone === 'loading' ? Loader2 : TriangleAlert;
  return (
    <div className="bg-background grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Icon
          className={cn(
            'size-10',
            tone === 'loading' ? 'text-linkle animate-spin' : 'text-destructive',
          )}
          aria-hidden
        />
        <p className="text-foreground text-base font-semibold">{title}</p>
        {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        ) : null}
        {tone === 'error' ? (
          <Button asChild size="sm" variant="ghost">
            <a href="/">홈으로</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface InlineErrorProps {
  detail: string;
  onRetry: () => void;
}

function InlineError({ detail, onRetry }: InlineErrorProps): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/30 bg-destructive/5 flex items-center gap-2 border-b',
        'text-destructive px-4 py-2 text-sm md:px-6',
      )}
    >
      <TriangleAlert size={16} aria-hidden />
      <span className="flex-1">문서 새로고침 실패: {detail}</span>
      <button type="button" onClick={onRetry} className="font-semibold underline">
        다시 시도
      </button>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function countPages(path: Path): number {
  return path.filter((p) => p.type === 'page').length;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

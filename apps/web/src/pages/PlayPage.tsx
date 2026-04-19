import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, ForcedEndPanel, HelpDialog, cn } from '@linkle/design-system';
import { ArrowLeft, CircleHelp, Loader2, TriangleAlert } from 'lucide-react';
import {
  fetchWikiPage,
  formatPageTitle,
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

/**
 * Game play surface.
 *
 * Visual layout is the three-region chrome familiar from the original
 * wikirace project:
 *   header (back | goal | help) · article (click-delegated) · footer (stats)
 *
 * Two design policies worth noting:
 *
 * 1. The game lives entirely at `/play`; navigating between Wikipedia
 *    articles does NOT change the URL. Instead, each article visit pushes
 *    an entry onto the browser history so the native Back button can pop
 *    the wiki stack the same way the on-screen back button does. That
 *    matches the player's mental model ("I was on X, back should go to the
 *    previous X") without leaking the game route to /play?title=… URLs.
 *
 * 2. In-article links and the chrome back button both route through the
 *    Zustand store (`visitPage`, `goBack`). The store is the single source
 *    of truth; the browser history only mirrors the wiki stack depth.
 */
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

  // Timer — hooks rules: unconditional.
  const startedAtForTimer = status.kind === 'playing' ? status.startedAt : null;
  const timerRunning = status.kind === 'playing';
  const elapsedMs = useElapsedMs(startedAtForTimer, timerRunning);

  const [helpOpen, setHelpOpen] = useState(false);
  const [linkLoadError, setLinkLoadError] = useState<string | null>(null);

  // ---- bootstrap --------------------------------------------------------

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

  const startPageQuery = useQuery({
    queryKey: ['wiki', 'start', challenge?.startPage ?? ''],
    queryFn: async () => {
      if (!challenge) throw new Error('no challenge');
      return fetchWikiPage(challenge.startPage);
    },
    enabled: challenge !== null,
    retry: 1,
  });
  useEffect(() => {
    if (status.kind !== 'idle') return;
    if (!startPageQuery.data) return;
    onFirstPageLoaded(sanitizeWikipediaHtml(startPageQuery.data.html), startPageQuery.data.title);
  }, [status.kind, startPageQuery.data, onFirstPageLoaded]);

  // ---- persistence & guards ---------------------------------------------

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

  useSearchGuard(
    useCallback(() => {
      forceEndDueToSearch();
    }, [forceEndDueToSearch]),
  );

  // ---- submission -------------------------------------------------------

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

  // ---- browser-history mirroring ----------------------------------------
  // Each successful wiki hop pushes a history entry tagged with the wiki
  // depth. Browser-back pops the wiki stack instead of leaving the game
  // (until we're at depth 1, at which point back exits to home).

  const wikiDepth = currentWikiDepth(status);
  const lastPushedDepth = useRef<number | null>(null);
  useEffect(() => {
    if (status.kind !== 'playing') return;
    if (wikiDepth <= 1) {
      // Mark the entry so popstate can tell we're at the root.
      window.history.replaceState({ linkleWikiDepth: 1 }, '');
      lastPushedDepth.current = 1;
      return;
    }
    if (lastPushedDepth.current !== null && wikiDepth > lastPushedDepth.current) {
      window.history.pushState({ linkleWikiDepth: wikiDepth }, '');
    } else {
      window.history.replaceState({ linkleWikiDepth: wikiDepth }, '');
    }
    lastPushedDepth.current = wikiDepth;
  }, [wikiDepth, status.kind]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent): void => {
      const s = useGameStore.getState();
      if (s.status.kind !== 'playing') return;
      const pages = s.status.path.filter((p) => p.type === 'page');
      if (pages.length <= 1) return; // let the navigation exit the game
      const targetDepthRaw = (e.state as { linkleWikiDepth?: unknown } | null)?.linkleWikiDepth;
      const targetDepth = typeof targetDepthRaw === 'number' ? targetDepthRaw : 1;
      if (targetDepth < pages.length) {
        goBack();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [goBack]);

  // ---- link click delegation --------------------------------------------

  const contentRef = useRef<HTMLDivElement | null>(null);
  const handleContentClick = useCallback(
    async (ev: React.MouseEvent<HTMLDivElement>) => {
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

      setLinkLoadError(null);
      try {
        const page = await fetchWikiPage(raw);
        onPageLoaded(sanitizeWikipediaHtml(page.html), page.title);
        contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      } catch (err) {
        console.error('failed to load next page', err);
        setLinkLoadError(
          err instanceof Error
            ? `문서를 불러오지 못했어요: ${err.message}`
            : '문서를 불러오지 못했어요.',
        );
        // Roll the visit back so the path doesn't record an unreachable page.
        goBack();
      }
    },
    [visitPage, onPageLoaded, submitIfReachedGoal, goBack],
  );

  useEffect(() => {
    if (status.kind === 'completed') {
      void navigate('/play/done', { replace: true });
    }
  }, [status.kind, navigate]);

  // ---- early-return guards ---------------------------------------------

  if (challengeQuery.isError) {
    return (
      <FullScreenStatus
        tone="error"
        title="오늘의 챌린지를 불러오지 못했어요"
        detail={String(challengeQuery.error)}
        onRetry={() => void challengeQuery.refetch()}
      />
    );
  }

  if (!challenge) {
    if (challengeQuery.isLoading || challengeQuery.data) {
      return <FullScreenStatus tone="loading" title="챌린지를 불러오는 중…" />;
    }
    return <Navigate replace to="/" />;
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

  // ---- render ----------------------------------------------------------

  const currentTitle = currentTitleOf(status) ?? challenge.startPage;
  const previousPageTitle = previousDistinctPage(status);
  const moveCount = statusMoveCount(status);
  const { startPage, endPage } = challenge;

  // Loading the very first Wikipedia page. This is the "stuck" state players
  // previously complained about when something went wrong silently.
  if (status.kind === 'idle' || !currentHtml) {
    if (startPageQuery.isError) {
      return (
        <FullScreenStatus
          tone="error"
          title="위키피디아에서 시작 문서를 불러오지 못했어요"
          detail={String(startPageQuery.error)}
          onRetry={() => void startPageQuery.refetch()}
        />
      );
    }
    return (
      <FullScreenStatus
        tone="loading"
        title="위키피디아 문서를 불러오는 중…"
        detail={`"${startPage}" 여는 중`}
      />
    );
  }

  const isChromeBusy = status.kind === 'submitting';

  return (
    <div className="bg-background flex h-[100dvh] flex-col">
      <GameHeader
        startPage={startPage}
        endPage={endPage}
        previousPageTitle={previousPageTitle}
        canGoBack={status.kind === 'playing' && previousPageTitle !== null}
        onGoBack={goBack}
        onHelp={() => {
          setHelpOpen(true);
        }}
        disabled={isChromeBusy}
      />

      {linkLoadError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 border-b px-4 py-2 text-sm md:px-6"
        >
          <TriangleAlert size={16} aria-hidden />
          <span className="flex-1">{linkLoadError}</span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setLinkLoadError(null);
            }}
          >
            닫기
          </button>
        </div>
      ) : null}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        ref={contentRef}
        onClick={(e) => {
          void handleContentClick(e);
        }}
        className="linkle-no-select bg-card flex-grow overflow-auto p-4"
      >
        <div
          className="wiki-content mx-auto max-w-3xl break-words"
          dangerouslySetInnerHTML={{ __html: currentHtml }}
        />
      </div>

      <GameFooter currentTitle={currentTitle} elapsedMs={elapsedMs} moveCount={moveCount} />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

// ─── Chrome ───────────────────────────────────────────────────────────────

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
}

function GameFooter({ currentTitle, elapsedMs, moveCount }: GameFooterProps): JSX.Element {
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

// ─── Full-screen loading/error ────────────────────────────────────────────

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

// ─── helpers ──────────────────────────────────────────────────────────────

function currentTitleOf(status: ReturnType<typeof useGameStore.getState>['status']): string | null {
  if (status.kind === 'playing') return status.currentTitle;
  return null;
}

function previousDistinctPage(
  status: ReturnType<typeof useGameStore.getState>['status'],
): string | null {
  if (status.kind !== 'playing') return null;
  const pages = status.path.filter(
    (p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page',
  );
  const prev = pages[pages.length - 2];
  return prev?.title ?? null;
}

function statusMoveCount(status: ReturnType<typeof useGameStore.getState>['status']): number {
  return status.kind === 'playing' || status.kind === 'submitting' || status.kind === 'completed'
    ? status.moveCount
    : 0;
}

function currentWikiDepth(status: ReturnType<typeof useGameStore.getState>['status']): number {
  if (status.kind !== 'playing' && status.kind !== 'submitting' && status.kind !== 'completed') {
    return 0;
  }
  return status.path.filter((p) => p.type === 'page').length;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

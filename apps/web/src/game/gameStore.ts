/**
 * Game domain state.
 *
 * Rule: this store is responsible for *what the player has done* — the path
 * they took, the clock, whether they've reached the goal. It does NOT hold
 * Wikipedia HTML; that is server state and lives in TanStack Query, keyed by
 * the current page title. Splitting the two like this means:
 *
 *   - A page refresh can rehydrate the path from localStorage and let Query
 *     refetch the HTML automatically — there is no "rehydrated but no HTML"
 *     stuck state.
 *   - StrictMode double-invoking effects can't leave us in a half-fetched
 *     state because there are no imperative `onPageLoaded(html, title)`
 *     actions to race.
 *   - The store is trivially serializable and unit-testable.
 *
 * The phase is a discriminated union so invalid transitions ("submit from
 * forcedEnd") are caught at the type level.
 */
import { create } from 'zustand';
import { isEndPage, type DailyChallenge, type Path, type PathEntry } from '@linkle/shared';

export type GameStatus =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'playing';
      readonly currentTitle: string;
      readonly path: Path;
      readonly moveCount: number;
      readonly startedAt: number;
    }
  | {
      readonly kind: 'submitting';
      readonly path: Path;
      readonly moveCount: number;
      readonly timeSec: number;
    }
  | {
      readonly kind: 'completed';
      readonly rank: number;
      readonly path: Path;
      readonly moveCount: number;
      readonly timeSec: number;
      readonly emojiResult: string | null;
    }
  | { readonly kind: 'forcedEnd'; readonly reason: 'search-detected' };

interface GameState {
  readonly challenge: DailyChallenge | null;
  readonly status: GameStatus;

  loadChallenge: (c: DailyChallenge) => void;
  /** Transition idle → playing using the challenge's start page. */
  startFresh: () => void;
  /** Restore an in-progress game from persisted path/moveCount. */
  rehydrate: (args: { path: Path; moveCount: number; startedAtMs: number }) => void;
  /** Append a page visit. Returns whether the new page is the goal. */
  visit: (title: string) => { reachedGoal: boolean };
  /** Append a back + previous-page pair. */
  goBack: () => void;
  /** Force-end because a disallowed hotkey was pressed. */
  forceEndDueToSearch: () => void;
  /** Move from playing to submitting. */
  beginSubmit: (timeSec: number) => void;
  /** Server acked; submitting → completed. */
  onSubmitted: (args: { rank: number; emojiResult: string | null }) => void;
  reset: () => void;
}

const idle: GameStatus = { kind: 'idle' };

export const useGameStore = create<GameState>()((set, get) => ({
  challenge: null,
  status: idle,

  loadChallenge: (challenge) => {
    set({ challenge });
  },

  startFresh: () => {
    const { challenge, status } = get();
    if (!challenge) return;
    if (status.kind !== 'idle') return;
    const startTitle = challenge.startPage;
    set({
      status: {
        kind: 'playing',
        currentTitle: startTitle,
        path: [{ type: 'page', title: startTitle }],
        moveCount: 0,
        startedAt: Date.now(),
      },
    });
  },

  rehydrate: ({ path, moveCount, startedAtMs }) => {
    const last = lastPageTitle(path);
    if (!last) return;
    set({
      status: {
        kind: 'playing',
        currentTitle: last,
        path,
        moveCount,
        startedAt: startedAtMs,
      },
    });
  },

  visit: (title) => {
    const state = get();
    if (state.status.kind !== 'playing' || !state.challenge) {
      return { reachedGoal: false };
    }
    const reachedGoal = isEndPage(title, state.challenge.endPage);
    const nextPath: Path = [...state.status.path, { type: 'page', title }];
    set({
      status: {
        ...state.status,
        path: nextPath,
        moveCount: state.status.moveCount + 1,
        currentTitle: title,
      },
    });
    return { reachedGoal };
  },

  goBack: () => {
    const state = get();
    if (state.status.kind !== 'playing') return;
    const distinctPages = state.status.path.filter(
      (p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page',
    );
    if (distinctPages.length < 2) return;
    const previous = distinctPages[distinctPages.length - 2];
    if (!previous) return;
    set({
      status: {
        ...state.status,
        path: [...state.status.path, { type: 'back' }, { type: 'page', title: previous.title }],
        moveCount: state.status.moveCount + 1,
        currentTitle: previous.title,
      },
    });
  },

  forceEndDueToSearch: () => {
    const { status } = get();
    if (status.kind === 'completed' || status.kind === 'forcedEnd') return;
    set({ status: { kind: 'forcedEnd', reason: 'search-detected' } });
  },

  beginSubmit: (timeSec) => {
    const { status } = get();
    if (status.kind !== 'playing') return;
    set({
      status: {
        kind: 'submitting',
        path: status.path,
        moveCount: status.moveCount,
        timeSec,
      },
    });
  },

  onSubmitted: ({ rank, emojiResult }) => {
    const { status } = get();
    if (status.kind !== 'submitting') return;
    set({
      status: {
        kind: 'completed',
        path: status.path,
        moveCount: status.moveCount,
        timeSec: status.timeSec,
        rank,
        emojiResult,
      },
    });
  },

  reset: () => {
    set({ challenge: null, status: idle });
  },
}));

// ---------- derived selectors ----------

export function selectCurrentTitle(status: GameStatus): string | null {
  return status.kind === 'playing' ? status.currentTitle : null;
}

export function selectPath(status: GameStatus): Path {
  if (status.kind === 'playing' || status.kind === 'submitting' || status.kind === 'completed') {
    return status.path;
  }
  return [];
}

export function selectMoveCount(status: GameStatus): number {
  if (status.kind === 'playing' || status.kind === 'submitting' || status.kind === 'completed') {
    return status.moveCount;
  }
  return 0;
}

export function selectCanGoBack(status: GameStatus): boolean {
  if (status.kind !== 'playing') return false;
  return status.path.filter((p) => p.type === 'page').length >= 2;
}

export function selectPreviousPageTitle(status: GameStatus): string | null {
  if (status.kind !== 'playing') return null;
  const pages = status.path.filter(
    (p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page',
  );
  return pages[pages.length - 2]?.title ?? null;
}

// ---------- helpers ----------

function lastPageTitle(path: Path): string | null {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const entry = path[i];
    if (entry?.type === 'page') return entry.title;
  }
  return null;
}

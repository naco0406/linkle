// Explicit game state machine. Each transition is a pure reducer mutation;
// illegal transitions are impossible to express because of the discriminated
// union on `status.kind` — the store methods only accept events valid in the
// current kind. See docs/architecture.md §5.

import { create } from 'zustand';
import {
  isEndPage,
  type DailyChallenge,
  type GameStatus,
  type Path,
  type PathEntry,
} from '@linkle/shared';

interface GameState {
  readonly challenge: DailyChallenge | null;
  readonly status: GameStatus;
  readonly currentHtml: string | null;

  // Hydration / lifecycle
  loadChallenge: (challenge: DailyChallenge) => void;
  beginLoading: () => void;
  onFirstPageLoaded: (html: string, title: string) => void;
  onPageLoaded: (html: string, title: string) => void;

  // In-game actions
  visitPage: (title: string) => { reachedGoal: boolean };
  goBack: () => void;
  forceEndDueToSearch: () => void;

  // Submission
  beginSubmit: (timeSec: number) => void;
  onSubmitted: (args: { rank: number; emojiResult: string | null }) => void;

  // Rehydration from localStorage
  rehydrate: (args: {
    challenge: DailyChallenge;
    path: Path;
    moveCount: number;
    startedAtMs: number;
  }) => void;

  reset: () => void;
}

const idleStatus: GameStatus = { kind: 'idle' };

export const useGameStore = create<GameState>()((set, get) => ({
  challenge: null,
  status: idleStatus,
  currentHtml: null,

  loadChallenge: (challenge) => {
    set({ challenge, status: idleStatus });
  },

  beginLoading: () => {
    set({ status: { kind: 'loading' } });
  },

  onFirstPageLoaded: (html, title) => {
    set({
      currentHtml: html,
      status: {
        kind: 'playing',
        currentTitle: title,
        path: [{ type: 'page', title }],
        moveCount: 0,
        startedAt: Date.now(),
      },
    });
  },

  onPageLoaded: (html, title) => {
    const s = get().status;
    if (s.kind !== 'playing') return;
    set({
      currentHtml: html,
      status: { ...s, currentTitle: title },
    });
  },

  visitPage: (title) => {
    const state = get();
    const { status, challenge } = state;
    if (status.kind !== 'playing' || !challenge) return { reachedGoal: false };
    const nextEntry: PathEntry = { type: 'page', title };
    const nextPath = [...status.path, nextEntry];
    const nextMoveCount = status.moveCount + 1;
    const reachedGoal = isEndPage(title, challenge.endPage);
    set({
      status: {
        ...status,
        path: nextPath,
        moveCount: nextMoveCount,
        currentTitle: title,
      },
    });
    return { reachedGoal };
  },

  goBack: () => {
    const state = get();
    const { status } = state;
    if (status.kind !== 'playing') return;
    // Find the previous distinct page in the path. The tail entry IS the
    // current page, so we need the one before it.
    const pages = status.path.filter(
      (p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page',
    );
    if (pages.length < 2) return;
    const target = pages[pages.length - 2]?.title;
    if (!target) return;
    set({
      status: {
        ...status,
        path: [...status.path, { type: 'back' }, { type: 'page', title: target }],
        moveCount: status.moveCount + 1,
        currentTitle: target,
      },
    });
  },

  forceEndDueToSearch: () => {
    const state = get().status;
    if (state.kind === 'completed' || state.kind === 'forcedEnd') return;
    set({ status: { kind: 'forcedEnd', reason: 'search-detected' } });
  },

  beginSubmit: (timeSec) => {
    const state = get().status;
    if (state.kind !== 'playing') return;
    set({
      status: {
        kind: 'submitting',
        path: state.path,
        moveCount: state.moveCount,
        timeSec,
      },
    });
  },

  onSubmitted: ({ rank, emojiResult }) => {
    const state = get().status;
    if (state.kind !== 'submitting') return;
    set({
      status: {
        kind: 'completed',
        path: state.path,
        moveCount: state.moveCount,
        timeSec: state.timeSec,
        rank,
        emojiResult,
      },
    });
  },

  rehydrate: ({ challenge, path, moveCount, startedAtMs }) => {
    const lastPage = [...path]
      .reverse()
      .find((p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page');
    if (!lastPage) {
      set({ challenge, status: idleStatus });
      return;
    }
    set({
      challenge,
      status: {
        kind: 'playing',
        currentTitle: lastPage.title,
        path,
        moveCount,
        startedAt: startedAtMs,
      },
    });
  },

  reset: () => {
    set({ challenge: null, status: idleStatus, currentHtml: null });
  },
}));

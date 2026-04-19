import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCanGoBack,
  selectCurrentTitle,
  selectMoveCount,
  selectPreviousPageTitle,
  useGameStore,
} from './gameStore.js';
import type { DailyChallenge } from '@linkle/shared';

const challenge: DailyChallenge = {
  date: '2026-04-19',
  startPage: '대한민국',
  endPage: '무궁화',
  totalCount: 0,
};

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('loadChallenge only sets the challenge; status stays idle', () => {
    useGameStore.getState().loadChallenge(challenge);
    const s = useGameStore.getState();
    expect(s.challenge).toEqual(challenge);
    expect(s.status.kind).toBe('idle');
  });

  it('startFresh moves idle → playing with a single-entry path', () => {
    const { loadChallenge, startFresh } = useGameStore.getState();
    loadChallenge(challenge);
    startFresh();
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.currentTitle).toBe('대한민국');
    expect(s.status.path).toEqual([{ type: 'page', title: '대한민국' }]);
    expect(s.status.moveCount).toBe(0);
    expect(selectCurrentTitle(s.status)).toBe('대한민국');
    expect(selectCanGoBack(s.status)).toBe(false);
  });

  it('startFresh is a no-op without a challenge', () => {
    useGameStore.getState().startFresh();
    expect(useGameStore.getState().status.kind).toBe('idle');
  });

  it('startFresh is a no-op once we are already playing', () => {
    const { loadChallenge, startFresh, visit } = useGameStore.getState();
    loadChallenge(challenge);
    startFresh();
    visit('영국');
    useGameStore.getState().startFresh();
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(selectMoveCount(s.status)).toBe(1);
  });

  it('visit appends a page entry and flags the goal', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.startFresh();

    const mid = store.visit('영국');
    expect(mid.reachedGoal).toBe(false);

    const hit = useGameStore.getState().visit('무궁화');
    expect(hit.reachedGoal).toBe(true);

    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(selectMoveCount(s.status)).toBe(2);
    expect(selectCurrentTitle(s.status)).toBe('무궁화');
  });

  it('goBack records the back token and flips currentTitle back', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.startFresh();
    store.visit('영국');
    useGameStore.getState().goBack();

    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(selectCurrentTitle(s.status)).toBe('대한민국');
    expect(selectMoveCount(s.status)).toBe(2);
    expect(s.status.path.some((p) => p.type === 'back')).toBe(true);
    // Path now holds [대한민국, 영국, back, 대한민국] — three page entries —
    // so canGoBack stays true (next goBack would land on 영국 again).
    expect(selectCanGoBack(s.status)).toBe(true);
  });

  it('goBack is a no-op without a distinct previous page', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.startFresh();
    useGameStore.getState().goBack();
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.path).toHaveLength(1);
  });

  it('rehydrate restores playing state from a persisted path', () => {
    const { loadChallenge, rehydrate } = useGameStore.getState();
    loadChallenge(challenge);
    rehydrate({
      path: [
        { type: 'page', title: '대한민국' },
        { type: 'page', title: '영국' },
      ],
      moveCount: 1,
      startedAtMs: 1_000_000,
    });
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(selectCurrentTitle(s.status)).toBe('영국');
    expect(s.status.startedAt).toBe(1_000_000);
    expect(selectCanGoBack(s.status)).toBe(true);
    expect(selectPreviousPageTitle(s.status)).toBe('대한민국');
  });

  it('forceEndDueToSearch transitions from playing to forcedEnd', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.startFresh();
    useGameStore.getState().forceEndDueToSearch();
    expect(useGameStore.getState().status.kind).toBe('forcedEnd');
  });

  it('forceEndDueToSearch is ignored once completed', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.startFresh();
    store.visit('무궁화');
    store.beginSubmit(42);
    store.onSubmitted({ rank: 1, emojiResult: null });
    useGameStore.getState().forceEndDueToSearch();
    expect(useGameStore.getState().status.kind).toBe('completed');
  });
});

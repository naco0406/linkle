import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore.js';
import type { DailyChallenge } from '@linkle/shared';

const challenge: DailyChallenge = {
  date: '2026-04-18',
  startPage: '대한민국',
  endPage: '비틀즈',
  totalCount: 0,
};

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('loads a challenge into idle state', () => {
    useGameStore.getState().loadChallenge(challenge);
    const s = useGameStore.getState();
    expect(s.challenge).toEqual(challenge);
    expect(s.status.kind).toBe('idle');
  });

  it('transitions idle → loading → playing on first page load', () => {
    const { loadChallenge, beginLoading, onFirstPageLoaded } = useGameStore.getState();
    loadChallenge(challenge);
    beginLoading();
    expect(useGameStore.getState().status.kind).toBe('loading');
    onFirstPageLoaded('<p>hi</p>', '대한민국');
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.currentTitle).toBe('대한민국');
    expect(s.status.path).toEqual([{ type: 'page', title: '대한민국' }]);
    expect(s.status.moveCount).toBe(0);
  });

  it('visitPage extends path and detects goal via isEndPage', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.beginLoading();
    store.onFirstPageLoaded('<p/>', '대한민국');
    const first = store.visitPage('영국');
    expect(first.reachedGoal).toBe(false);
    const goal = useGameStore.getState().visitPage('비틀즈');
    expect(goal.reachedGoal).toBe(true);
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.moveCount).toBe(2);
    expect(s.status.path).toHaveLength(3);
  });

  it('goBack pops to the previous distinct page', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.beginLoading();
    store.onFirstPageLoaded('<p/>', '대한민국');
    store.visitPage('영국');
    useGameStore.getState().goBack();
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.currentTitle).toBe('대한민국');
    expect(s.status.path.at(-1)).toEqual({ type: 'page', title: '대한민국' });
    expect(s.status.path.some((p) => p.type === 'back')).toBe(true);
    expect(s.status.moveCount).toBe(2);
  });

  it('goBack is a no-op when there is no history', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.beginLoading();
    store.onFirstPageLoaded('<p/>', '대한민국');
    useGameStore.getState().goBack();
    const s = useGameStore.getState();
    if (s.status.kind !== 'playing') throw new Error('expected playing');
    expect(s.status.path).toHaveLength(1);
  });

  it('forceEndDueToSearch transitions to forcedEnd from playing', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.beginLoading();
    store.onFirstPageLoaded('<p/>', '대한민국');
    useGameStore.getState().forceEndDueToSearch();
    expect(useGameStore.getState().status.kind).toBe('forcedEnd');
  });

  it('forceEndDueToSearch is a no-op in completed state', () => {
    const store = useGameStore.getState();
    store.loadChallenge(challenge);
    store.beginLoading();
    store.onFirstPageLoaded('<p/>', '대한민국');
    store.visitPage('비틀즈');
    store.beginSubmit(42);
    store.onSubmitted({ rank: 1, emojiResult: null });
    useGameStore.getState().forceEndDueToSearch();
    expect(useGameStore.getState().status.kind).toBe('completed');
  });
});

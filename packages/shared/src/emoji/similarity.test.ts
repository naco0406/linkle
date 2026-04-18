import { describe, expect, it } from 'vitest';
import {
  BACK_EMOJI,
  GOAL_EMOJI,
  renderPathEmoji,
  reasonsToSimilarityArray,
  similarityToEmoji,
} from './similarity.js';
import type { Path } from '../types/index.js';

describe('similarityToEmoji', () => {
  it('picks the bucket inclusively at lower bound', () => {
    expect(similarityToEmoji(1)).toBe('🟦');
    expect(similarityToEmoji(0.8)).toBe('🟦');
    expect(similarityToEmoji(0.79999)).toBe('🟩');
    expect(similarityToEmoji(0.6)).toBe('🟩');
    expect(similarityToEmoji(0.4)).toBe('🟨');
    expect(similarityToEmoji(0.2)).toBe('🟧');
    expect(similarityToEmoji(0.1)).toBe('🟥');
    expect(similarityToEmoji(0)).toBe('🟥');
  });

  it('clamps out-of-range values', () => {
    expect(similarityToEmoji(-0.5)).toBe('🟥');
    expect(similarityToEmoji(2)).toBe('🟦');
  });

  it('handles non-finite inputs defensively', () => {
    expect(similarityToEmoji(Number.NaN)).toBe('🟥');
    expect(similarityToEmoji(Number.POSITIVE_INFINITY)).toBe('🟥');
  });
});

describe('renderPathEmoji', () => {
  const path: Path = [
    { type: 'page', title: '대한민국' },
    { type: 'page', title: '문화' },
    { type: 'back' },
    { type: 'page', title: '외젠 들라크루아' }, // goal
  ];

  it('marks the last page with the goal flag', () => {
    const result = renderPathEmoji(path, [0.25, 0.7, 1]);
    expect(result.endsWith(GOAL_EMOJI)).toBe(true);
  });

  it('uses ⏪ for back entries regardless of similarity list', () => {
    const result = renderPathEmoji(path, [0.25, 0.7, 1]);
    expect(result).toContain(BACK_EMOJI);
  });

  it('uses the similarity index for non-goal pages only', () => {
    const result = renderPathEmoji(path, [0.25, 0.7, 1]);
    expect(result).toBe(`🟧🟩${BACK_EMOJI}${GOAL_EMOJI}`);
  });

  it('defaults missing similarities to 🟥', () => {
    const result = renderPathEmoji(path, []);
    expect(result).toBe(`🟥🟥${BACK_EMOJI}${GOAL_EMOJI}`);
  });
});

describe('reasonsToSimilarityArray', () => {
  it('fills indices from the OpenAI response shape', () => {
    const reasons = [
      { index: 0, word: 'a', similarity: 0.1, reason: '' },
      { index: 2, word: 'c', similarity: 0.9, reason: '' },
    ];
    expect(reasonsToSimilarityArray(reasons, 3)).toEqual([0.1, null, 0.9]);
  });

  it('ignores out-of-range indices', () => {
    const reasons = [{ index: 5, word: '?', similarity: 1, reason: '' }];
    expect(reasonsToSimilarityArray(reasons, 3)).toEqual([null, null, null]);
  });
});

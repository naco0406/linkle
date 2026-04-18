import type { OpenAiReasonEntry, Path } from '../types/index.js';

export type SimilarityEmoji = '🟦' | '🟩' | '🟨' | '🟧' | '🟥';
export const BACK_EMOJI = '⏪' as const;
export const GOAL_EMOJI = '🏁' as const;

/**
 * Map a similarity score ∈ [0, 1] to a colored square.
 * Buckets (see docs/design-system.md §2.2):
 *   ≥ 0.8 → 🟦, ≥ 0.6 → 🟩, ≥ 0.4 → 🟨, ≥ 0.2 → 🟧, else 🟥
 */
export function similarityToEmoji(similarity: number): SimilarityEmoji {
  if (!Number.isFinite(similarity)) return '🟥';
  const clamped = Math.max(0, Math.min(1, similarity));
  if (clamped >= 0.8) return '🟦';
  if (clamped >= 0.6) return '🟩';
  if (clamped >= 0.4) return '🟨';
  if (clamped >= 0.2) return '🟧';
  return '🟥';
}

/**
 * Render a player's path as an emoji sequence. The final goal page is always
 * `🏁` regardless of similarity, and `back` entries are always `⏪`.
 *
 * `similarities` is indexed by the order of **page entries only** (back-entries
 * are skipped). This mirrors how the OpenAI reasoner is called on the server.
 */
export function renderPathEmoji(
  path: Path,
  similaritiesByPageIndex: readonly (number | null)[],
): string {
  let pageIndex = -1;
  const pageCount = path.filter((p) => p.type === 'page').length;
  const out: string[] = [];

  for (const entry of path) {
    if (entry.type === 'back') {
      out.push(BACK_EMOJI);
      continue;
    }
    pageIndex += 1;
    const isGoal = pageIndex === pageCount - 1;
    if (isGoal) {
      out.push(GOAL_EMOJI);
      continue;
    }
    const score = similaritiesByPageIndex[pageIndex];
    out.push(similarityToEmoji(typeof score === 'number' ? score : 0));
  }

  return out.join('');
}

/** Extract a flat similarity array from an OpenAI response list. */
export function reasonsToSimilarityArray(
  reasons: readonly OpenAiReasonEntry[],
  length: number,
): (number | null)[] {
  const arr: (number | null)[] = new Array<number | null>(length).fill(null);
  for (const r of reasons) {
    if (r.index >= 0 && r.index < length) {
      arr[r.index] = r.similarity;
    }
  }
  return arr;
}

// Domain types + Zod schemas used across the web, admin, and API surfaces.
// Rule: everything that crosses a trust boundary (network, storage, URL) must
// be parsed through these schemas. No `any` leaks past here.

import { z } from 'zod';

// ---------- Path model ----------

/**
 * A single step in the player's journey.
 * - `page` — the player navigated to a Wikipedia article.
 * - `back` — the player used the "뒤로가기" action.
 */
export const pathEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page'), title: z.string().min(1).max(500) }),
  z.object({ type: z.literal('back') }),
]);
export type PathEntry = z.infer<typeof pathEntrySchema>;

export const pathSchema = z.array(pathEntrySchema).max(500);
// Use the z.infer shape so Path assignments work in both directions; callers
// that only read may locally narrow to `readonly PathEntry[]`.
export type Path = z.infer<typeof pathSchema>;

// ---------- Challenge ----------

/** KST date string. Always formatted as YYYY-MM-DD. */
export const challengeDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD (KST)');
export type ChallengeDate = z.infer<typeof challengeDateSchema>;

export const dailyChallengeSchema = z.object({
  date: challengeDateSchema,
  startPage: z.string().min(1).max(500),
  endPage: z.string().min(1).max(500),
  totalCount: z.number().int().nonnegative().default(0),
});
export type DailyChallenge = z.infer<typeof dailyChallengeSchema>;

// ---------- Ranking ----------

export type RankingSort = 'fastest' | 'leastClicks' | 'firstToFinish';
export const rankingSortSchema = z.enum(['fastest', 'leastClicks', 'firstToFinish']);

export const rankingSchema = z.object({
  id: z.string().min(1),
  challengeDate: challengeDateSchema,
  userId: z.string().min(1).max(128),
  nickname: z.string().min(1).max(40),
  moveCount: z.number().int().nonnegative(),
  timeSec: z.number().int().nonnegative(),
  path: pathSchema,
  submittedAt: z.number().int().positive(), // unix ms
  emojiResult: z.string().max(400).nullable(),
});
export type Ranking = z.infer<typeof rankingSchema>;

// ---------- Submission (client → API) ----------

export const rankingSubmissionSchema = z.object({
  challengeDate: challengeDateSchema,
  userId: z.string().min(1).max(128),
  nickname: z.string().min(1).max(40),
  moveCount: z.number().int().nonnegative().max(1000),
  timeSec: z
    .number()
    .int()
    .nonnegative()
    .max(60 * 60 * 24),
  path: pathSchema,
});
export type RankingSubmission = z.infer<typeof rankingSubmissionSchema>;

// ---------- Statistics ----------

export const openAiReasonEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  word: z.string(),
  similarity: z.number().min(0).max(1),
  reason: z.string(),
});
export type OpenAiReasonEntry = z.infer<typeof openAiReasonEntrySchema>;

export const dailyStatisticsSchema = z.object({
  challengeDate: challengeDateSchema,
  startPage: z.string(),
  endPage: z.string(),
  totalCount: z.number().int().nonnegative(),
  shortestPath: z
    .object({
      rankingId: z.string(),
      nickname: z.string(),
      moveCount: z.number().int().nonnegative(),
      path: pathSchema,
      emojiResult: z.string().nullable(),
      reason: z.array(openAiReasonEntrySchema).nullable(),
    })
    .nullable(),
  fastestTime: z
    .object({
      rankingId: z.string(),
      nickname: z.string(),
      timeSec: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type DailyStatistics = z.infer<typeof dailyStatisticsSchema>;

// ---------- LocalStorage state ----------

export const localDailyStateSchema = z.object({
  date: challengeDateSchema,
  userId: z.string().min(1),
  nickname: z.string().min(1),
  path: pathSchema,
  moveCount: z.number().int().nonnegative(),
  startedAtMs: z.number().int().positive().nullable(),
  finishedAtMs: z.number().int().positive().nullable(),
  timeSec: z.number().int().nonnegative().nullable(),
  status: z.enum(['idle', 'playing', 'completed', 'forcedEnd']),
  emojiResult: z.string().nullable(),
  rank: z.number().int().positive().nullable(),
});
export type LocalDailyState = z.infer<typeof localDailyStateSchema>;

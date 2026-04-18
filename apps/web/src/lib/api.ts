// Typed HTTP client for @linkle/api. All responses are Zod-parsed so callers
// receive fully-validated domain types.

import {
  dailyChallengeSchema,
  dailyStatisticsSchema,
  rankingSchema,
  type DailyChallenge,
  type DailyStatistics,
  type Ranking,
  type RankingSort,
  type RankingSubmission,
} from '@linkle/shared';
import { z } from 'zod';
import { env } from '../config/env.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? `${String(status)} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const errorSchema = z.object({ error: z.string() });

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (body: unknown) => T,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const raw: unknown = await res
    .json()
    .catch(() => ({ error: `non-json-response (${String(res.status)})` }));
  if (!res.ok) {
    const parsedErr = errorSchema.safeParse(raw);
    throw new ApiError(res.status, parsedErr.success ? parsedErr.data.error : 'unknown');
  }
  return parse(raw);
}

// ---------- challenges ----------

const challengeResponseSchema = z.object({ challenge: dailyChallengeSchema });

export async function fetchTodayChallenge(): Promise<DailyChallenge> {
  return request(
    '/v1/challenges/today',
    { method: 'GET' },
    (raw) => challengeResponseSchema.parse(raw).challenge,
  );
}

export async function fetchChallenge(date: string): Promise<DailyChallenge> {
  return request(
    `/v1/challenges/${encodeURIComponent(date)}`,
    { method: 'GET' },
    (raw) => challengeResponseSchema.parse(raw).challenge,
  );
}

// ---------- rankings ----------

const submissionResponseSchema = z.object({
  rankingId: z.string(),
  rank: z.number().int().positive(),
  emojiDeferred: z.boolean(),
});

export async function submitRanking(body: RankingSubmission): Promise<{
  rankingId: string;
  rank: number;
  emojiDeferred: boolean;
}> {
  return request('/v1/rankings', { method: 'POST', body: JSON.stringify(body) }, (raw) =>
    submissionResponseSchema.parse(raw),
  );
}

const rankingsResponseSchema = z.object({ rankings: z.array(rankingSchema) });

export async function fetchRankings(
  date: string,
  sort: RankingSort,
  limit = 10,
): Promise<Ranking[]> {
  const qs = new URLSearchParams({ sort, limit: String(limit) });
  return request(
    `/v1/rankings/${encodeURIComponent(date)}?${qs.toString()}`,
    { method: 'GET' },
    (raw) => rankingsResponseSchema.parse(raw).rankings,
  );
}

// ---------- statistics ----------

const statisticsResponseSchema = z.object({ statistics: dailyStatisticsSchema });

export async function fetchStatistics(date: string): Promise<DailyStatistics> {
  return request(
    `/v1/statistics/${encodeURIComponent(date)}`,
    { method: 'GET' },
    (raw) => statisticsResponseSchema.parse(raw).statistics,
  );
}

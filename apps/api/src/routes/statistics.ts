import { Hono } from 'hono';
import {
  challengeDateSchema,
  openAiReasonEntrySchema,
  pathSchema,
  type DailyStatistics,
  type OpenAiReasonEntry,
} from '@linkle/shared';
import { z } from 'zod';
import type { Env } from '../env.js';
import { getChallenge } from '../db/challenges.js';

const reasonArraySchema = z.array(openAiReasonEntrySchema);

function parseReasonJson(json: string | null): OpenAiReasonEntry[] | null {
  if (json === null) return null;
  try {
    return reasonArraySchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

export const statisticsRoute = new Hono<{ Bindings: Env }>();

interface TopRankingRow {
  id: string;
  nickname: string;
  move_count: number;
  time_sec: number;
  path_json: string;
  emoji_result: string | null;
  reason_json: string | null;
}

/**
 * Lazy statistics. If not pre-computed, fold rankings on the fly.
 * A production deployment should add a Cron trigger that materializes this
 * into the `statistics` table at KST midnight; this route keeps yesterday's
 * page working even when that job hasn't run yet.
 */
statisticsRoute.get('/:date', async (c) => {
  const dateParse = challengeDateSchema.safeParse(c.req.param('date'));
  if (!dateParse.success) return c.json({ error: 'bad-date' }, 400);
  const date = dateParse.data;

  const challenge = await getChallenge(c.env.DB, date);
  if (!challenge) return c.json({ error: 'no-challenge' }, 404);

  const shortest = await c.env.DB.prepare(
    `SELECT id, nickname, move_count, time_sec, path_json, emoji_result, reason_json
       FROM rankings
       WHERE challenge_date = ?1
       ORDER BY move_count ASC, time_sec ASC
       LIMIT 1`,
  )
    .bind(date)
    .first<TopRankingRow>();

  const fastest = await c.env.DB.prepare(
    `SELECT id, nickname, move_count, time_sec, path_json, emoji_result, reason_json
       FROM rankings
       WHERE challenge_date = ?1
       ORDER BY time_sec ASC, move_count ASC
       LIMIT 1`,
  )
    .bind(date)
    .first<TopRankingRow>();

  const result: DailyStatistics = {
    challengeDate: date,
    startPage: challenge.startPage,
    endPage: challenge.endPage,
    totalCount: challenge.totalCount,
    shortestPath: shortest
      ? {
          rankingId: shortest.id,
          nickname: shortest.nickname,
          moveCount: shortest.move_count,
          path: pathSchema.parse(JSON.parse(shortest.path_json)),
          emojiResult: shortest.emoji_result,
          reason: parseReasonJson(shortest.reason_json),
        }
      : null,
    fastestTime: fastest
      ? {
          rankingId: fastest.id,
          nickname: fastest.nickname,
          timeSec: fastest.time_sec,
        }
      : null,
  };

  return c.json({ statistics: result });
});

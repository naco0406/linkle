import { pathSchema, type Ranking, type RankingSort, type RankingSubmission } from '@linkle/shared';
import { type z } from 'zod';

type MutablePath = z.infer<typeof pathSchema>;

interface RankingRow {
  id: string;
  challenge_date: string;
  user_id: string;
  nickname: string;
  move_count: number;
  time_sec: number;
  path_json: string;
  submitted_at: number;
  emoji_result: string | null;
}

function parsePath(json: string): MutablePath {
  const parsed: unknown = JSON.parse(json);
  return pathSchema.parse(parsed);
}

function rowToRanking(row: RankingRow): Ranking {
  return {
    id: row.id,
    challengeDate: row.challenge_date,
    userId: row.user_id,
    nickname: row.nickname,
    moveCount: row.move_count,
    timeSec: row.time_sec,
    path: parsePath(row.path_json),
    submittedAt: row.submitted_at,
    emojiResult: row.emoji_result,
  };
}

/**
 * Insert a new ranking. Returns { rank } on success or throws on uniqueness
 * violation (one submission per (date, user_id)).
 */
export async function insertRanking(
  db: D1Database,
  id: string,
  submission: RankingSubmission,
  submittedAt: number,
): Promise<{ rank: number }> {
  await db
    .prepare(
      `INSERT INTO rankings
        (id, challenge_date, user_id, nickname, move_count, time_sec, path_json, submitted_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      id,
      submission.challengeDate,
      submission.userId,
      submission.nickname,
      submission.moveCount,
      submission.timeSec,
      JSON.stringify(submission.path),
      submittedAt,
    )
    .run();

  const countRow = await db
    .prepare('SELECT COUNT(*) AS n FROM rankings WHERE challenge_date = ?1')
    .bind(submission.challengeDate)
    .first<{ n: number }>();
  return { rank: countRow?.n ?? 1 };
}

const sortColumns: Record<RankingSort, string> = {
  fastest: 'time_sec ASC, move_count ASC',
  leastClicks: 'move_count ASC, time_sec ASC',
  firstToFinish: 'submitted_at ASC',
};

export async function listRankings(
  db: D1Database,
  date: string,
  sort: RankingSort,
  limit: number,
): Promise<Ranking[]> {
  const order = sortColumns[sort];
  const rows = await db
    .prepare(
      `SELECT id, challenge_date, user_id, nickname, move_count, time_sec,
              path_json, submitted_at, emoji_result
       FROM rankings
       WHERE challenge_date = ?1
       ORDER BY ${order}
       LIMIT ?2`,
    )
    .bind(date, Math.max(1, Math.min(limit, 100)))
    .all<RankingRow>();
  return rows.results.map(rowToRanking);
}

export async function updateRankingEmoji(
  db: D1Database,
  id: string,
  emoji: string,
  reasonJson: string,
): Promise<void> {
  await db
    .prepare('UPDATE rankings SET emoji_result = ?1, reason_json = ?2 WHERE id = ?3')
    .bind(emoji, reasonJson, id)
    .run();
}

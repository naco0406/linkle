import type { ChallengeDate, DailyChallenge } from '@linkle/shared';

interface ChallengeRow {
  date: string;
  start_page: string;
  end_page: string;
}

export async function getChallenge(
  db: D1Database,
  date: ChallengeDate,
): Promise<DailyChallenge | null> {
  const row = await db
    .prepare('SELECT date, start_page, end_page FROM challenges WHERE date = ?1')
    .bind(date)
    .first<ChallengeRow>();

  if (!row) return null;

  const total = await db
    .prepare('SELECT COUNT(*) AS n FROM rankings WHERE challenge_date = ?1')
    .bind(date)
    .first<{ n: number }>();

  return {
    date: row.date,
    startPage: row.start_page,
    endPage: row.end_page,
    totalCount: total?.n ?? 0,
  };
}

export async function upsertChallenge(
  db: D1Database,
  input: Omit<DailyChallenge, 'totalCount'>,
  createdBy: string | null,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO challenges (date, start_page, end_page, created_at, created_by)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(date) DO UPDATE SET
         start_page = excluded.start_page,
         end_page   = excluded.end_page,
         created_by = excluded.created_by`,
    )
    .bind(input.date, input.startPage, input.endPage, now, createdBy)
    .run();
}

export async function deleteChallenge(db: D1Database, date: ChallengeDate): Promise<void> {
  await db.prepare('DELETE FROM challenges WHERE date = ?1').bind(date).run();
}

export async function listChallenges(
  db: D1Database,
  from: ChallengeDate,
  to: ChallengeDate,
): Promise<DailyChallenge[]> {
  const rows = await db
    .prepare(
      `SELECT c.date, c.start_page, c.end_page,
              (SELECT COUNT(*) FROM rankings r WHERE r.challenge_date = c.date) AS total_count
       FROM challenges c
       WHERE c.date BETWEEN ?1 AND ?2
       ORDER BY c.date DESC`,
    )
    .bind(from, to)
    .all<ChallengeRow & { total_count: number }>();
  return rows.results.map((r) => ({
    date: r.date,
    startPage: r.start_page,
    endPage: r.end_page,
    totalCount: r.total_count,
  }));
}

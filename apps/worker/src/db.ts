import type { MoveEvent, Puzzle } from '@linkle/core'
import type { RunKind, Settled } from './rules.ts'

// D1을 읽고 쓰는 곳. 한 판에 쓰기는 시작 때 한 번, 완료 때 한 번으로 묶는다 (무료 요금제의 하루 쓰기 한도).

type PuzzleRow = {
  id: number
  kind: Puzzle['kind']
  number: number
  date: string | null
  start_id: number
  start_title: string
  end_id: number
  end_title: string
  status: string
  author_id: string | null
  clears: number
}

const PUZZLE_COLUMNS = 'id, kind, number, date, start_id, start_title, end_id, end_title, status, author_id, clears'

export type StoredPuzzle = { puzzle: Puzzle; status: string; authorId: string | null; clears: number }

function toStored(row: PuzzleRow): StoredPuzzle {
  return {
    puzzle: {
      id: row.id,
      kind: row.kind,
      number: row.number,
      date: row.date,
      start: { id: row.start_id, title: row.start_title },
      end: { id: row.end_id, title: row.end_title },
    },
    status: row.status,
    authorId: row.author_id,
    clears: row.clears,
  }
}

/** 그 날짜의 오늘의 문제 */
export async function findDaily(db: D1Database, date: string): Promise<StoredPuzzle | null> {
  const row = await db
    .prepare(`SELECT ${PUZZLE_COLUMNS} FROM puzzles WHERE date = ?1 AND kind = 'daily' AND status = 'published'`)
    .bind(date)
    .first<PuzzleRow>()
  return row && toStored(row)
}

export async function findPuzzle(db: D1Database, id: number): Promise<StoredPuzzle | null> {
  const row = await db.prepare(`SELECT ${PUZZLE_COLUMNS} FROM puzzles WHERE id = ?1`).bind(id).first<PuzzleRow>()
  return row && toStored(row)
}

/**
 * Run을 만든다. 기록에 드는 판(ranked)은 문제마다 기기당 하나뿐이다.
 * 오늘의 문제를 다시 요청하면 처음 만든 Run을 그대로 돌려준다.
 * "문제를 본 순간부터 타이머가 흐른다"는 규칙이 이렇게 지켜진다: 새로 시작해도 시작 시각이 바뀌지 않는다.
 */
export async function startRun(
  db: D1Database,
  input: { puzzleId: number; playerId: string; kind: RunKind; now: number },
): Promise<{ runId: string; startedAt: number }> {
  const { puzzleId, playerId, kind, now } = input
  const runId = crypto.randomUUID()
  // 닉네임은 무한 모드(구현 순서 9번)에서 붙인다. 그때까지는 비워 둔다
  const player = db.prepare(`INSERT INTO players (id, name, created_at) VALUES (?1, '', ?2) ON CONFLICT (id) DO NOTHING`).bind(playerId, now)
  const insert = (ranked: 0 | 1) =>
    db
      .prepare('INSERT INTO runs (id, puzzle_id, mode, ranked, player_id, started_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT DO NOTHING')
      .bind(runId, puzzleId, kind.mode, ranked, playerId, now)
  const fresh = { runId, startedAt: now }

  if (!kind.ranked) {
    await db.batch([player, insert(0)])
    return fresh
  }

  // 넣기와 읽기를 한 번에 보낸다. 이미 기록에 드는 Run이 있으면 넣기는 조용히 무시되고, 읽기가 그 Run을 돌려준다.
  // 같은 기기가 동시에 두 번 요청해도 유일 제약(runs_ranked_once) 덕분에 둘 다 같은 Run을 받는다.
  const ranked = db.prepare('SELECT id, started_at FROM runs WHERE puzzle_id = ?1 AND player_id = ?2 AND ranked = 1').bind(puzzleId, playerId)
  const results = await db.batch<{ id: string; started_at: number }>([player, insert(1), ranked])
  const existing = results[2]?.results[0]
  if (!existing || existing.id === runId) return fresh
  if (kind.mode === 'daily') return { runId: existing.id, startedAt: existing.started_at }

  // 커뮤니티 문제의 두 번째 도전부터는 순위에 들지 않는 새 Run이다
  await insert(0).run()
  return fresh
}

export type RunForFinish = {
  playerId: string
  startedAt: number
  /** 이미 끝난 Run이면 저장된 결과 */
  finished: FinishResult | null
  puzzle: Puzzle
}

/** order는 그 문제를 몇 번째로 끝냈는지. 기록에 들지 않는 판은 null */
export type FinishResult = { order: number | null; durationMs: number }

type RunRow = PuzzleRow & {
  player_id: string
  started_at: number
  finished_at: number | null
  duration_ms: number | null
  finish_order: number | null
}

export async function findRunForFinish(db: D1Database, runId: string): Promise<RunForFinish | null> {
  const row = await db
    .prepare(
      `SELECT r.player_id, r.started_at, r.finished_at, r.duration_ms, r.finish_order,
              p.id, p.kind, p.number, p.date, p.start_id, p.start_title, p.end_id, p.end_title, p.status, p.author_id, p.clears
       FROM runs r JOIN puzzles p ON p.id = r.puzzle_id WHERE r.id = ?1`,
    )
    .bind(runId)
    .first<RunRow>()
  if (!row) return null
  return {
    playerId: row.player_id,
    startedAt: row.started_at,
    finished: row.finished_at === null ? null : { order: row.finish_order, durationMs: row.duration_ms ?? 0 },
    puzzle: toStored(row).puzzle,
  }
}

/**
 * 완료를 저장하고 완료 순서를 매긴다. 이미 끝난 Run이면 아무것도 바꾸지 않고 저장된 결과를 돌려준다.
 *
 * 순서는 runs를 세지 않고 puzzles.clears에서 뽑는다. 매번 세면 완료가 쌓일수록 읽는 행이 늘어
 * 하루 읽기 한도를 금방 쓴다(완료 3천 건이면 450만 행). 두 문장은 한 트랜잭션으로 실행되므로
 * 동시에 끝낸 두 사람이 같은 순서를 받지 않는다.
 */
export async function saveFinish(
  db: D1Database,
  input: { runId: string; now: number; settled: Settled; events: readonly MoveEvent[]; emoji: string[] | null },
): Promise<FinishResult | null> {
  const { runId, now, settled, events, emoji } = input
  const count = db
    .prepare('UPDATE puzzles SET clears = clears + 1 WHERE id = (SELECT puzzle_id FROM runs WHERE id = ?1 AND finished_at IS NULL AND ranked = 1)')
    .bind(runId)
  const finish = db
    .prepare(
      `UPDATE runs SET finished_at = ?2, duration_ms = ?3, moves = ?4, events = ?5, emoji = ?6, flags = ?7,
              finish_order = CASE WHEN ranked = 1 THEN (SELECT clears FROM puzzles WHERE id = runs.puzzle_id) END
       WHERE id = ?1 AND finished_at IS NULL
       RETURNING finish_order, duration_ms`,
    )
    .bind(runId, now, settled.durationMs, settled.moves, JSON.stringify(events), emoji && JSON.stringify(emoji), settled.flags.join(','))
  const results = await db.batch<{ finish_order: number | null; duration_ms: number }>([count, finish])
  const saved = results[1]?.results[0]
  if (saved) return { order: saved.finish_order, durationMs: saved.duration_ms }

  // 같은 제출이 동시에 두 번 왔고 다른 쪽이 먼저 저장했다. 저장된 결과를 읽어 돌려준다
  const row = await db.prepare('SELECT finish_order, duration_ms FROM runs WHERE id = ?1 AND finished_at IS NOT NULL').bind(runId).first<{ finish_order: number | null; duration_ms: number }>()
  return row && { order: row.finish_order, durationMs: row.duration_ms }
}

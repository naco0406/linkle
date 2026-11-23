import { ghostOf, nicknameOf, ROOM_CODE_ALPHABET, stackOf, type Ghost, type MoveEvent, type Page } from '@linkle/core'

// 친구와 겨루기의 D1 쪽(설계 문서 16장): 도전장, 이름 다시 뽑기, 친구에게 내기, 커뮤니티에 올리기, 신고.

/** 도전장 코드. 방 코드와 같은 31글자로 여섯 자리(약 8억 개) */
export function newCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map(b => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('')
}
export const isChallengeCode = (s: string) => /^[A-Z2-9]{6}$/.test(s) && [...s].every(c => ROOM_CODE_ALPHABET.includes(c))

/**
 * 끝낸 판으로 도전장을 만든다. 같은 판이면 같은 코드다.
 * 오늘의 문제는 1차에서 뺐다(16.7). 끝내지 않은 판, 남의 판은 안 된다.
 */
export async function createChallenge(db: D1Database, runId: string, playerId: string, now: number): Promise<{ code: string } | { error: string }> {
  const run = await db
    .prepare(`SELECT r.player_id, r.finished_at, p.kind, p.status FROM runs r JOIN puzzles p ON p.id = r.puzzle_id WHERE r.id = ?1`)
    .bind(runId)
    .first<{ player_id: string; finished_at: number | null; kind: string; status: string }>()
  if (!run) return { error: 'run_not_found' }
  if (run.player_id !== playerId) return { error: 'not_owner' }
  if (run.finished_at === null) return { error: 'not_finished' }
  if (run.kind === 'daily') return { error: 'daily' }
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode()
    await db
      .prepare(`INSERT INTO challenges (code, puzzle_id, run_id, player_id, created_at) SELECT ?1, puzzle_id, id, player_id, ?3 FROM runs WHERE id = ?2 ON CONFLICT DO NOTHING`)
      .bind(code, runId, now)
      .run()
    const row = await db.prepare(`SELECT code FROM challenges WHERE run_id = ?1`).bind(runId).first<{ code: string }>()
    if (row) return { code: row.code }
  }
  return { error: 'internal' }
}

export type ChallengeRow = { name: string; ms: number; moves: number; me: boolean; sender: boolean }
export type ChallengeInfo = {
  code: string
  /** 보낸 사람이 출제자면 길을 알고 푼 것이라 이동 수로 겨룬다(16.4) */
  byAuthor: boolean
  puzzle: { id: number; kind: string; number: number; difficulty: string | null }
  sender: { name: string; ms: number; moves: number; emoji: string[] | null }
  takers: number
  /** 같은 링크로 푼 사람끼리의 순위. 시간 먼저(16.7) */
  board: ChallengeRow[]
  /** 요청한 기기가 이 문제를 끝냈으면 두 길(문서 이름이 들어 있다) */
  compare: { mine: { ms: number; moves: number; path: Step[] }; theirs: { path: Step[] } } | null
}
export type Step = { id: number; title: string; emoji: string | null; back: boolean }

const pathOf = (start: Page, events: MoveEvent[], emoji: string[] | null): Step[] => [
  { id: start.id, title: start.title, emoji: null, back: false },
  ...events.map((e, i) => ({ id: e.to.id, title: e.to.title, emoji: emoji?.[i] ?? null, back: e.type === 'back' })),
]
const parse = <T>(s: string | null): T | null => {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

type SenderRow = {
  code: string
  puzzle_id: number
  run_id: string
  player_id: string
  takers: number
  kind: string
  number: number
  difficulty: string | null
  start_id: number
  start_title: string
  author_id: string | null
  name: string | null
  duration_ms: number
  moves: number
  events: string
  emoji: string | null
}

async function senderOf(db: D1Database, code: string): Promise<SenderRow | null> {
  return db
    .prepare(
      `SELECT c.code, c.puzzle_id, c.run_id, c.player_id, c.takers, p.kind, p.number, p.difficulty, p.start_id, p.start_title, p.author_id,
              pl.name, r.duration_ms, r.moves, r.events, r.emoji
       FROM challenges c JOIN runs r ON r.id = c.run_id JOIN puzzles p ON p.id = c.puzzle_id LEFT JOIN players pl ON pl.id = c.player_id
       WHERE c.code = ?1 AND p.status IN ('published', 'unlisted')`,
    )
    .bind(code)
    .first<SenderRow>()
}

/** 도전장 카드. 출발·도착 문서는 담지 않는다. compare는 요청한 기기가 이미 끝낸 판이 있을 때만 */
export async function challengeInfo(db: D1Database, code: string, playerId: string | null): Promise<ChallengeInfo | null> {
  const s = await senderOf(db, code)
  if (!s) return null
  const [board, mine] = await db.batch([
    // 사람마다 가장 빠른 판 하나. 보낸 사람의 판도 들어간다
    db
      .prepare(
        `SELECT r.player_id, COALESCE(pl.name, '') AS name, MIN(r.duration_ms) AS ms, r.moves
         FROM runs r LEFT JOIN players pl ON pl.id = r.player_id
         WHERE (r.challenge = ?1 OR r.id = ?2) AND r.finished_at IS NOT NULL
         GROUP BY r.player_id ORDER BY ${s.author_id === s.player_id ? 'r.moves, ms' : 'ms, r.moves'} LIMIT 20`,
      )
      .bind(code, s.run_id),
    db
      .prepare(`SELECT duration_ms, moves, events, emoji FROM runs WHERE puzzle_id = ?1 AND player_id = ?2 AND finished_at IS NOT NULL AND id != ?3 ORDER BY (challenge = ?4) DESC, finished_at LIMIT 1`)
      .bind(s.puzzle_id, playerId ?? '', s.run_id, code),
  ])
  type B = { player_id: string; name: string; ms: number; moves: number }
  const rows = ((board?.results ?? []) as B[]).map(r => ({ name: r.name || nicknameOf(r.player_id), ms: r.ms, moves: r.moves, me: r.player_id === playerId, sender: r.player_id === s.player_id }))
  const m = (mine?.results[0] as { duration_ms: number; moves: number; events: string; emoji: string | null } | undefined) ?? null
  const start = { id: s.start_id, title: s.start_title }
  const emoji = parse<string[]>(s.emoji)
  return {
    code,
    byAuthor: s.author_id === s.player_id,
    puzzle: { id: s.puzzle_id, kind: s.kind, number: s.number, difficulty: s.difficulty },
    sender: { name: s.name || nicknameOf(s.player_id), ms: s.duration_ms, moves: s.moves, emoji },
    takers: s.takers,
    board: rows,
    compare:
      m && playerId !== s.player_id
        ? {
            mine: { ms: m.duration_ms, moves: m.moves, path: pathOf(start, parse<MoveEvent[]>(m.events) ?? [], parse<string[]>(m.emoji)) },
            theirs: { path: pathOf(start, parse<MoveEvent[]>(s.events) ?? [], emoji) },
          }
        : null,
  }
}

/** 도전장으로 시작할 때 함께 보내는 고스트. 문서 이름은 빠진다 */
export async function ghostFor(db: D1Database, code: string, puzzleId: number): Promise<Ghost | null> {
  const s = await senderOf(db, code)
  if (!s || s.puzzle_id !== puzzleId) return null
  return ghostOf(s.name || nicknameOf(s.player_id), parse<MoveEvent[]>(s.events) ?? [], parse<string[]>(s.emoji), s.duration_ms)
}

/** 이름 다시 뽑기. 이름은 기기 id와 salt로 정해진다 */
export async function rename(db: D1Database, playerId: string, salt: number, now: number): Promise<string> {
  const name = nicknameOf(playerId, salt)
  await db
    .prepare(`INSERT INTO players (id, name, created_at, salt) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET name = excluded.name, salt = excluded.salt`)
    .bind(playerId, name, now, salt)
    .run()
  return name
}

// ── 친구에게 내기(16.4) ──

/** 하루에 낼 수 있는 문제 수(기기당) */
export const DAILY_MAKE_LIMIT = 5
/** 커뮤니티에 올릴 수 있는 기준(16.7): 친구 5명 이상 도전, 도착률 20% 이상 */
export const PUBLISH_MIN_PLAYS = 5
export const PUBLISH_MIN_RATE = 0.2
/** 신고가 이만큼 쌓이면 목록에서 숨긴다. 관리자 화면에서 되돌린다 */
export const REPORT_HIDE_AT = 3

/** 사람이 고른 출발·도착의 제목 규칙. 날짜, 연도, 목록, 동음이의는 문제로 쓰지 않는다(7.3과 같은 생각) */
export function titleProblem(title: string): string | null {
  if (/^\d+년$|^기원전 \d+년$|^\d+년대$|^\d+세기$/.test(title)) return 'year'
  if (/^\d{1,2}월( \d{1,2}일)?$/.test(title)) return 'date'
  if (/목록|일람/.test(title)) return 'list'
  if (/\(동음이의\)$/.test(title)) return 'disambig'
  return null
}

/** 출제 초안을 만든다. 출제자가 직접 풀어 도착해야 unlisted로 바뀐다 */
export async function createDraft(db: D1Database, input: { authorId: string; start: Page; end: Page; now: number }): Promise<{ id: number } | { error: string }> {
  const { authorId, start, end, now } = input
  const made = await db.prepare(`SELECT COUNT(*) AS n FROM puzzles WHERE author_id = ?1 AND created_at > ?2`).bind(authorId, now - 86_400_000).first<{ n: number }>()
  if ((made?.n ?? 0) >= DAILY_MAKE_LIMIT) return { error: 'too_many' }
  const dup = await db.prepare(`SELECT id, author_id, status FROM puzzles WHERE start_id = ?1 AND end_id = ?2 AND kind != 'daily'`).bind(start.id, end.id).first<{ id: number; author_id: string | null; status: string }>()
  // 내가 만들다 만 초안이면 그대로 이어서 푼다
  if (dup) return dup.author_id === authorId && dup.status === 'draft' ? { id: dup.id } : { error: 'duplicate' }
  const row = await db
    .prepare(
      `INSERT INTO puzzles (kind, number, start_id, start_title, end_id, end_title, author_id, status, created_at)
       SELECT 'community', COALESCE(MAX(number), 0) + 1, ?1, ?2, ?3, ?4, ?5, 'draft', ?6 FROM puzzles WHERE kind = 'community'
       RETURNING id`,
    )
    .bind(start.id, start.title, end.id, end.title, authorId, now)
    .first<{ id: number }>()
  return row ? { id: row.id } : { error: 'internal' }
}

/** 출제자가 초안을 풀어 도착했다. 그 길이 정답 예시가 되고 링크가 있는 사람은 풀 수 있게 된다 */
export async function solveDraft(db: D1Database, puzzleId: number, start: Page, events: readonly MoveEvent[]): Promise<void> {
  const stack = stackOf(start, events)
  const solution = stack.slice(1).map((p, i) => ({ id: p.id, title: p.title, via: viaOf(events, p.id) ?? p.title, i }))
  await db
    .prepare(`UPDATE puzzles SET status = 'unlisted', author_moves = ?2, par = ?3, solution = ?4 WHERE id = ?1 AND status = 'draft'`)
    .bind(puzzleId, events.length, stack.length - 1, JSON.stringify(solution.map(({ id, title, via }) => ({ id, title, via }))))
    .run()
}

function viaOf(events: readonly MoveEvent[], id: number): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!
    if (e.type === 'link' && e.to.id === id) return e.via
  }
  return null
}

export type MineRow = {
  id: number
  number: number
  status: string
  start_title: string
  end_title: string
  author_moves: number | null
  plays: number
  clears: number
  shorter: number
  created_at: number
  canPublish: boolean
  /** 출제자의 길(정답 예시). 출제자 관전 화면이 쓴다 */
  solution: { id: number; title: string }[]
}

/** 내가 낸 문제. 출제자는 자기 문제의 문서 이름을 본다 */
export async function myPuzzles(db: D1Database, authorId: string): Promise<MineRow[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.number, p.status, p.start_title, p.end_title, p.author_moves, p.plays, p.clears, p.created_at, p.solution,
              (SELECT COUNT(DISTINCT r.player_id) FROM runs r WHERE r.puzzle_id = p.id AND r.finished_at IS NOT NULL AND r.player_id != ?1 AND r.moves < p.author_moves) AS shorter
       FROM puzzles p WHERE p.author_id = ?1 AND p.kind = 'community' AND p.status != 'hidden'
       ORDER BY p.id DESC LIMIT 50`,
    )
    .bind(authorId)
    .all<Omit<MineRow, 'canPublish' | 'solution'> & { solution: string | null }>()
  return results.map(r => ({ ...r, solution: parse<{ id: number; title: string }[]>(r.solution) ?? [], canPublish: r.status === 'unlisted' && canPublish(r.plays, r.clears) }))
}

export const canPublish = (plays: number, clears: number) => plays >= PUBLISH_MIN_PLAYS && clears / Math.max(plays, 1) >= PUBLISH_MIN_RATE

/** 친구들이 풀어 본 문제를 커뮤니티 목록에 올린다 */
export async function publish(db: D1Database, puzzleId: number, authorId: string): Promise<'ok' | 'not_found' | 'not_ready'> {
  const p = await db.prepare(`SELECT status, plays, clears FROM puzzles WHERE id = ?1 AND author_id = ?2 AND kind = 'community'`).bind(puzzleId, authorId).first<{ status: string; plays: number; clears: number }>()
  if (!p) return 'not_found'
  if (p.status === 'published') return 'ok'
  if (p.status !== 'unlisted' || !canPublish(p.plays, p.clears)) return 'not_ready'
  await db.prepare(`UPDATE puzzles SET status = 'published', created_at = ?2 WHERE id = ?1`).bind(puzzleId, Date.now()).run()
  return 'ok'
}

/** 신고. 기기당 한 번. 쌓이면 사람이 낸 문제는 숨긴다 */
export async function report(db: D1Database, puzzleId: number, playerId: string, now: number): Promise<{ hidden: boolean }> {
  await db.prepare(`INSERT INTO reports (puzzle_id, player_id, at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING`).bind(puzzleId, playerId, now).run()
  const r = await db
    .prepare(
      `UPDATE puzzles SET status = 'hidden' WHERE id = ?1 AND kind = 'community' AND status IN ('published', 'unlisted')
         AND (SELECT COUNT(*) FROM reports WHERE puzzle_id = ?1) >= ?2`,
    )
    .bind(puzzleId, REPORT_HIDE_AT)
    .run()
  return { hidden: (r.meta.changes ?? 0) > 0 }
}

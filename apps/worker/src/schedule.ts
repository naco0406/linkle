import { addDays, kstDate, type MoveEvent, type Page } from '@linkle/core'
import { findDaily } from './db.ts'
import { verifyPath, type WikiApi } from './verify.ts'

// 대기열에서 오늘의 문제를 하루씩 꺼내 날짜에 붙인다. 순수 함수와 DB 작업을 함께 둔다.

export type Difficulty = 'easy' | 'normal' | 'hard'

export type QueueRow = {
  id: number
  start_id: number
  start_title: string
  end_id: number
  end_title: string
  par: number | null
  difficulty: Difficulty | null
  solution: string | null
  priority?: number
}

/**
 * 요일마다 내고 싶은 난이도. 주초는 쉽게, 주말은 어렵게(시간이 많은 날).
 * 대기열에 맞는 것이 없으면 아무 난이도나 낸다.
 */
export function wantedDifficulty(date: string): Difficulty {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 // 0 = 월요일
  return weekday <= 1 ? 'easy' : weekday <= 4 ? 'normal' : 'hard'
}

/**
 * 대기열에서 낼 순서를 정한다. 최근 30일 안에 출발이나 도착으로 나온 문서는 건너뛴다.
 * 원하는 난이도를 먼저, 그다음은 대기열 순서대로.
 */
export function chooseOrder(queue: QueueRow[], recent: Set<number>, want: Difficulty): QueueRow[] {
  const fresh = queue.filter(q => !recent.has(q.start_id) && !recent.has(q.end_id))
  // 관리자가 앞으로 당긴 문제(priority > 0)는 난이도와 상관없이 먼저 낸다
  const pinned = fresh.filter(q => (q.priority ?? 0) > 0)
  const rest = fresh.filter(q => (q.priority ?? 0) <= 0)
  return [...pinned, ...rest.filter(q => q.difficulty === want), ...rest.filter(q => q.difficulty !== want)]
}

/** 저장된 정답 예시를 이동 로그 꼴로 바꾼다. 경로 확인(verifyPath)에 그대로 넣는다 */
export function solutionEvents(solution: string | null): MoveEvent[] | null {
  if (!solution) return null
  try {
    const hops = JSON.parse(solution) as { id: number; title: string; via: string }[]
    if (!Array.isArray(hops) || hops.length === 0) return null
    return hops.map((h, i) => ({ type: 'link', to: { id: h.id, title: h.title }, via: h.via, at: i }))
  } catch {
    return null
  }
}

/** 문제를 내기 전에 몇 개까지 확인해 볼지. 하나에 위키백과 요청 두 번이다 */
const TRIES = 4

/**
 * 그날의 문제가 없으면 대기열에서 하나 꺼내 붙인다.
 * 꺼낸 문제의 정답 예시가 지금 위키백과에서도 이어지는지 먼저 확인한다(편집으로 링크가 사라졌을 수 있다).
 * 끊겼으면 그 문제는 빼고 다음 것을 본다. 위키백과에 닿지 못하면 WikiUnavailable이 그대로 올라가 다음 차례에 다시 한다.
 */
export async function assignDay(db: D1Database, api: WikiApi, date: string, now: number): Promise<string> {
  if (await findDaily(db, date)) return 'exists'
  const [queue, recent] = await db.batch([
    db.prepare(`SELECT id, start_id, start_title, end_id, end_title, par, difficulty, solution, priority FROM puzzle_queue WHERE status = 'approved' AND pool = 'daily' ORDER BY priority DESC, id LIMIT 40`),
    db.prepare(`SELECT start_id, end_id FROM puzzles WHERE kind = 'daily' AND date >= ?1`).bind(addDays(date, -30)),
  ])
  const recentPages = new Set((recent?.results as { start_id: number; end_id: number }[]).flatMap(r => [r.start_id, r.end_id]))
  const order = chooseOrder((queue?.results ?? []) as QueueRow[], recentPages, wantedDifficulty(date))
  for (const row of order.slice(0, TRIES)) {
    const start: Page = { id: row.start_id, title: row.start_title }
    const events = solutionEvents(row.solution)
    const verdict = events ? await verifyPath(start, events, api) : ({ ok: false, reason: 'no_solution' } as const)
    if (!verdict.ok) {
      await db.prepare(`UPDATE puzzle_queue SET status = 'rejected', note = ?2 WHERE id = ?1`).bind(row.id, `${date} 확인 실패: ${verdict.reason}`).run()
      continue
    }
    // 번호는 그 날짜 앞의 마지막 번호 다음이다. 하루가 비어도 번호는 이어진다
    const inserted = await db
      .prepare(
        `INSERT INTO puzzles (kind, number, date, start_id, start_title, end_id, end_title, par, difficulty, solution, created_at)
         SELECT 'daily', COALESCE(MAX(number), 0) + 1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 FROM puzzles WHERE kind = 'daily' AND date < ?1
         ON CONFLICT DO NOTHING`,
      )
      .bind(date, row.start_id, row.start_title, row.end_id, row.end_title, row.par, row.difficulty, row.solution, now)
      .run()
    // 다른 요청이 먼저 붙였으면(동시에 돈 예약 작업) 대기열의 문제는 그대로 둔다
    if (!inserted.meta.changes) return 'exists'
    await db.prepare(`UPDATE puzzle_queue SET status = 'used', note = ?2 WHERE id = ?1`).bind(row.id, date).run()
    return `${row.start_title} → ${row.end_title}`
  }
  return order.length === 0 ? 'queue empty' : 'no valid puzzle'
}

/** 오늘과 내일의 문제를 채운다. 내일 것을 하루 앞서 붙여 두어, 자정에 문제가 비지 않게 한다 */
export async function fillUpcoming(db: D1Database, api: WikiApi, now: number): Promise<string> {
  const today = kstDate(now)
  const results: string[] = []
  for (const date of [today, addDays(today, 1)]) results.push(`${date} ${await assignDay(db, api, date, now)}`)
  const left = await db.prepare(`SELECT COUNT(*) AS n FROM puzzle_queue WHERE status = 'approved' AND pool = 'daily'`).first<{ n: number }>()
  // 남은 문제가 일주일 치 아래면 로그로 알린다. 문제 채우기(GitHub Actions)를 손으로 돌리면 된다
  if ((left?.n ?? 0) < 7) results.push(`대기열 ${left?.n ?? 0}개 남음`)
  return results.join(' · ')
}

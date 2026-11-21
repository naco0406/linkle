import { addDays } from './time.ts'

// 오늘의 문제를 어느 날 낼지 정하는 규칙(설계 문서 7.4, 7.5).
// Worker가 실제로 문제를 붙일 때와, 관리자 화면이 앞으로의 일정을 미리 보일 때 같은 코드를 쓴다.

export type Difficulty = 'easy' | 'normal' | 'hard'

/** 순서를 정하는 데 필요한 칸만. 대기열의 한 줄 */
export type ScheduleRow = { start_id: number; end_id: number; difficulty: Difficulty | null; priority?: number }

/** 최근 30일 안에 출발이나 도착으로 나온 문서는 다시 내지 않는다 */
export const RECENT_DAYS = 30

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
 * 관리자가 당긴 문제가 먼저, 그다음 원하는 난이도, 그다음 대기열 순서대로.
 */
export function chooseOrder<T extends ScheduleRow>(queue: T[], recent: Set<number>, want: Difficulty): T[] {
  const fresh = queue.filter(q => !recent.has(q.start_id) && !recent.has(q.end_id))
  const pinned = fresh.filter(q => (q.priority ?? 0) > 0)
  const rest = fresh.filter(q => (q.priority ?? 0) <= 0)
  return [...pinned, ...rest.filter(q => q.difficulty === want), ...rest.filter(q => q.difficulty !== want)]
}

/** 이미 날짜가 붙은 오늘의 문제 */
export type Placed = { date: string; start_id: number; end_id: number }

/**
 * 앞으로의 일정을 미리 계산한다. from부터 하루씩, 대기열(낼 순서: 당긴 것 먼저, 그다음 들어온 순서)에서
 * Worker와 같은 규칙으로 하나씩 꺼낸다. 출제 때 정답 경로 확인에서 빠지는 문제가 있으면 실제로는 하루씩 밀린다.
 * 최근 30일 규칙 때문에 그날 낼 문제가 없으면 그날은 비우고 다음 날로 넘어간다.
 */
export function projectSchedule<T extends ScheduleRow>(queue: T[], placed: Placed[], from: string, maxDays = 400): { date: string; row: T }[] {
  const out: { date: string; row: T }[] = []
  const used = [...placed]
  let left = [...queue]
  for (let i = 0; i < maxDays && left.length > 0; i++) {
    const date = addDays(from, i)
    const since = addDays(date, -RECENT_DAYS)
    // Worker는 그 날짜 30일 전부터의 문제를 모두(이미 붙은 앞날 포함) 최근 문서로 본다
    const recent = new Set(used.filter(p => p.date >= since).flatMap(p => [p.start_id, p.end_id]))
    const pick = chooseOrder(left, recent, wantedDifficulty(date))[0]
    if (!pick) continue
    out.push({ date, row: pick })
    used.push({ date, start_id: pick.start_id, end_id: pick.end_id })
    left = left.filter(r => r !== pick)
  }
  return out
}

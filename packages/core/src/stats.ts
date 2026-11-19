import { addDays, daysBetween } from './time.ts'

/** 내 기록. 기기에만 저장한다. 오늘의 문제만 센다(지난 문제와 커뮤니티는 들어가지 않는다) */
export type Stats = {
  v: 1
  /** 끝까지 푼 오늘의 문제 수 */
  played: number
  /** 마지막으로 푼 날까지 이어진 연속 일수 */
  streak: number
  maxStreak: number
  /** 마지막으로 푼 문제의 날짜 (KST YYYY-MM-DD) */
  lastDate: string | null
  /** 최근에 푼 날짜들. 주간 표시에 쓴다. 오래된 것은 버린다 */
  days: string[]
  /** 이동 횟수 → 그 횟수로 끝낸 판 수 */
  moves: Record<number, number>
  totalMoves: number
  /** 최근에 푼 날의 결과. 어제의 기록에서 내 자리를 보여 줄 때 쓴다 */
  recent: Record<string, { moves: number; ms: number }>
}

const KEEP_DAYS = 60

export function emptyStats(): Stats {
  return { v: 1, played: 0, streak: 0, maxStreak: 0, lastDate: null, days: [], moves: {}, totalMoves: 0, recent: {} }
}

/**
 * 오늘의 문제를 끝낸 것을 기록한다. 같은 날짜를 두 번 넣어도 한 번만 센다.
 * 날짜는 푼 시각이 아니라 문제의 날짜다. 자정을 넘겨 끝내도 그 문제의 날로 센다.
 */
export function recordDaily(stats: Stats, done: { date: string; moves: number; ms: number }): Stats {
  if (stats.days.includes(done.date) || (stats.lastDate !== null && done.date <= stats.lastDate)) return stats
  const gap = stats.lastDate === null ? null : daysBetween(stats.lastDate, done.date)
  const streak = gap === 1 ? stats.streak + 1 : 1
  const days = [...stats.days, done.date].slice(-KEEP_DAYS)
  const recent: Stats['recent'] = {}
  for (const d of days) {
    const r = d === done.date ? { moves: done.moves, ms: done.ms } : stats.recent[d]
    if (r) recent[d] = r
  }
  return {
    ...stats,
    played: stats.played + 1,
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastDate: done.date,
    days,
    recent,
    moves: { ...stats.moves, [done.moves]: (stats.moves[done.moves] ?? 0) + 1 },
    totalMoves: stats.totalMoves + done.moves,
  }
}

export type StreakState = {
  /** 지금 살아 있는 연속 일수. 어제도 오늘도 풀지 않았으면 0 */
  count: number
  /** 오늘 문제를 풀었는지 */
  doneToday: boolean
  /** 어제까지 이어 왔고 오늘 풀면 늘어나는 상태인지 */
  atRisk: boolean
}

export function streakOn(stats: Stats, today: string): StreakState {
  if (stats.lastDate === null) return { count: 0, doneToday: false, atRisk: false }
  const gap = daysBetween(stats.lastDate, today)
  if (gap <= 0) return { count: stats.streak, doneToday: true, atRisk: false }
  if (gap === 1) return { count: stats.streak, doneToday: false, atRisk: true }
  return { count: 0, doneToday: false, atRisk: false }
}

export type WeekDay = {
  date: string
  /** 0 = 월요일 … 6 = 일요일 */
  weekday: number
  state: 'done' | 'missed' | 'today' | 'future'
}


/** 오늘이 들어 있는 주(월~일)의 하루하루. 오늘은 풀었으면 done, 아직이면 today */
export function weekOf(stats: Stats, today: string): WeekDay[] {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const done = new Set(stats.days)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - weekday)
    const state = done.has(date) ? 'done' : i === weekday ? 'today' : i > weekday ? 'future' : 'missed'
    return { date, weekday: i, state }
  })
}

export type MoveBin = { label: string; count: number; from: number; to: number }

/** 이동 횟수 분포. 3번 이하부터 9번 이상까지 일곱 칸 */
export function moveDistribution(stats: Stats): MoveBin[] {
  return binMoves(stats.moves)
}

/** 이동 횟수 → 판 수를 일곱 칸으로 묶는다. 어제의 기록도 같은 칸을 쓴다 */
export function binMoves(counts: Record<number, number>): MoveBin[] {
  const bins = [
    { label: '3번', from: 0, to: 3 },
    { label: '4번', from: 4, to: 4 },
    { label: '5번', from: 5, to: 5 },
    { label: '6번', from: 6, to: 6 },
    { label: '7번', from: 7, to: 7 },
    { label: '8번', from: 8, to: 8 },
    { label: '9번+', from: 9, to: Infinity },
  ]
  return bins.map(b => ({
    ...b,
    count: Object.entries(counts).reduce((n, [m, c]) => (Number(m) >= b.from && Number(m) <= b.to ? n + c : n), 0),
  }))
}

export function averageMoves(stats: Stats): number | null {
  return stats.played === 0 ? null : stats.totalMoves / stats.played
}

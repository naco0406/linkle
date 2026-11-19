import { BACK_EMOJI, GOAL_EMOJI, LEVEL_EMOJI, UNKNOWN_EMOJI, type DailyRecord, type MoveEvent, type Page, type Puzzle, type YesterdayStats } from '@linkle/core'

// 어제의 기록을 모으고 확인하는 규칙. DB도 위키백과도 모르는 순수 함수라 Worker 없이 테스트한다.

/** 기록 후보. 순서대로 확인해서 처음 통과한 것이 기록이 된다 */
export type Candidate = { runId: string; moves: number; durationMs: number }

/** daily_stats.payload에 저장하는 모양. 공개할 때는 내부 칸을 뺀다(toPublic) */
export type StoredStats = Omit<YesterdayStats, 'status' | 'verifying'> & {
  v: 1
  puzzleId: number
  /** 기록 확인이 끝났는지 */
  done: boolean
  candidates: { shortest: Candidate[]; fastest: Candidate[] }
  /** 확인한 후보: runId → 'ok' 또는 걸린 이유 */
  checked: Record<string, string>
}

/** 한 종류의 기록마다 몇 명까지 후보로 둘지 */
export const CANDIDATES = 5

export type Aggregate = {
  moves: { moves: number; count: number }[]
  medianMs: number | null
  topPages: { id: number; title: string; count: number }[]
  shortest: Candidate[]
  fastest: Candidate[]
}

/** 자정이 지나고 처음 모은 결과로 저장할 값을 만든다. 기록은 아직 비어 있다 */
export function initialStats(puzzle: Puzzle, agg: Aggregate): StoredStats {
  const moves: Record<number, number> = {}
  for (const m of agg.moves) moves[m.moves] = m.count
  const finished = agg.moves.reduce((n, m) => n + m.count, 0)
  const empty = agg.shortest.length === 0 && agg.fastest.length === 0
  return {
    v: 1,
    puzzleId: puzzle.id,
    date: puzzle.date ?? '',
    number: puzzle.number,
    start: puzzle.start,
    end: puzzle.end,
    finished,
    moves,
    medianMs: agg.medianMs,
    topPages: agg.topPages,
    shortest: null,
    fastest: null,
    done: empty,
    candidates: { shortest: agg.shortest, fastest: agg.fastest },
    checked: {},
  }
}

export function toPublic(s: StoredStats): YesterdayStats {
  return {
    status: 'ready',
    date: s.date,
    number: s.number,
    start: s.start,
    end: s.end,
    finished: s.finished,
    moves: s.moves,
    medianMs: s.medianMs,
    topPages: s.topPages,
    shortest: s.shortest,
    fastest: s.fastest,
    verifying: !s.done,
  }
}

type Kind = 'shortest' | 'fastest'
const KINDS: Kind[] = ['shortest', 'fastest']

/**
 * 다음에 확인할 후보. 종류마다 아직 기록이 없으면, 앞에서부터 확인하지 않은 첫 후보다.
 * 앞의 후보가 통과했으면 그 종류는 더 확인하지 않는다.
 */
export function nextToCheck(s: StoredStats): string[] {
  const ids = new Set<string>()
  for (const kind of KINDS) {
    if (s[kind]) continue
    for (const c of s.candidates[kind]) {
      const v = s.checked[c.runId]
      if (v === 'ok') break
      if (v === undefined) {
        ids.add(c.runId)
        break
      }
    }
  }
  return [...ids]
}

/** 종류마다 앞에서부터 처음 통과한 후보. 아직 확인하지 않은 후보가 앞에 있으면 null */
export function winners(s: StoredStats): Record<Kind, string | null> {
  const pick = (list: Candidate[]) => {
    for (const c of list) {
      const v = s.checked[c.runId]
      if (v === 'ok') return c.runId
      if (v === undefined) return null
    }
    return null
  }
  return { shortest: pick(s.candidates.shortest), fastest: pick(s.candidates.fastest) }
}

/** 더 확인할 것이 없는지. 종류마다 기록이 정해졌거나 후보를 다 확인했으면 끝이다 */
export function isDone(s: StoredStats): boolean {
  return KINDS.every(kind => s[kind] !== null || s.candidates[kind].every(c => s.checked[c.runId] !== undefined))
}

/** 기록에 실을 경로. 출발부터 도착까지, 되돌아간 이동은 back으로 표시한다 */
export function pathOf(start: Page, events: readonly MoveEvent[]): DailyRecord['path'] {
  return [{ ...start, back: false }, ...events.map(e => ({ id: e.to.id, title: e.to.title, back: e.type === 'back' }))]
}

const LEVELS = new Set<string>([...LEVEL_EMOJI, UNKNOWN_EMOJI])

/**
 * 기기가 보낸 이모지를 기록에 실어도 되는지 본다. 되돌아감과 도착의 자리가 로그와 맞아야 한다.
 * 색 자체는 서버가 다시 계산할 수 없어 믿는다. 이모지는 표시에만 쓰이고 순위에 쓰이지 않는다.
 */
export function cleanEmoji(events: readonly MoveEvent[], emoji: unknown): string[] | null {
  if (!Array.isArray(emoji) || emoji.length !== events.length) return null
  for (const [i, e] of events.entries()) {
    const m = emoji[i]
    const last = i === events.length - 1
    if (e.type === 'back' ? m !== BACK_EMOJI : last ? m !== GOAL_EMOJI : typeof m !== 'string' || !LEVELS.has(m)) return null
  }
  return emoji as string[]
}

export function recordOf(start: Page, run: { moves: number; durationMs: number; events: MoveEvent[]; emoji: unknown }): DailyRecord {
  return { moves: run.moves, durationMs: run.durationMs, path: pathOf(start, run.events), emoji: cleanEmoji(run.events, run.emoji) }
}

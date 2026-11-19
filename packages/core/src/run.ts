import { RUN_VERSION, type MoveEvent, type Page, type Puzzle, type Run, type RunMode } from './types.ts'

export function createRun(init: { mode: RunMode; puzzle: Puzzle; runId: string; startedAt: number }): Run {
  return {
    v: RUN_VERSION,
    mode: init.mode,
    puzzle: init.puzzle,
    runId: init.runId,
    phase: 'playing',
    startedAt: init.startedAt,
    finishedAt: null,
    events: [],
    leads: {},
    flags: [],
    emoji: null,
    result: null,
    outbox: 'none',
  }
}

/** 로그를 재생해 방문 스택을 만든다. 맨 위가 현재 문서다 */
export function stackOf(start: Page, events: readonly MoveEvent[]): Page[] {
  const stack: Page[] = [start]
  for (const e of events) {
    if (e.type === 'link') stack.push(e.to)
    else if (stack.length > 1) stack.pop()
  }
  return stack
}

export function currentPage(run: Run): Page {
  return run.events.at(-1)?.to ?? run.puzzle.start
}

/** 뒤로가기를 누르면 갈 문서. 출발 문서에 있으면 null */
export function backTarget(run: Run): Page | null {
  return stackOf(run.puzzle.start, run.events).at(-2) ?? null
}

/** 이동 횟수. 뒤로가기도 한 번으로 센다 */
export function moveCount(run: Run): number {
  return run.events.length
}

/** 결과 화면에 보여 줄 경로. 뒤로가기로 돌아간 문서도 다시 나온다 */
export function pathOf(run: Run): { page: Page; back: boolean }[] {
  return [{ page: run.puzzle.start, back: false }, ...run.events.map(e => ({ page: e.to, back: e.type === 'back' }))]
}

/**
 * 링크 이동을 확정한다. 문서를 실제로 받은 뒤에만 부른다.
 * to는 넘겨주기를 거친 최종 문서이고, 도착 판정은 그 id로 한다.
 */
export function applyLink(run: Run, move: { to: Page; via: string; at: number; lead?: string }): Run {
  if (run.phase !== 'playing') return run
  const at = Math.max(move.at, lastAt(run))
  const events: MoveEvent[] = [...run.events, { type: 'link', to: move.to, via: move.via, at }]
  const leads = move.lead === undefined ? run.leads : { ...run.leads, [move.to.id]: move.lead }
  if (move.to.id !== run.puzzle.end.id) return { ...run, events, leads }
  return { ...run, events, leads, phase: 'finished', finishedAt: run.startedAt + at, outbox: 'pending' }
}

/** 뒤로가기. 출발 문서에서는 아무 일도 없다 */
export function applyBack(run: Run, at: number): Run {
  if (run.phase !== 'playing') return run
  const to = backTarget(run)
  if (!to) return run
  return { ...run, events: [...run.events, { type: 'back', to, at: Math.max(at, lastAt(run)) }] }
}

export function addFlag(run: Run, flag: string): Run {
  return run.flags.includes(flag) ? run : { ...run, flags: [...run.flags, flag] }
}

/** 소요 시간(ms). 진행 중이면 now 기준. now는 서버 시각으로 보정한 값을 넘긴다 */
export function elapsedMs(run: Run, now: number): number {
  return Math.max(0, (run.finishedAt ?? now) - run.startedAt)
}

function lastAt(run: Run): number {
  return run.events.at(-1)?.at ?? 0
}

export type LogCheck = { ok: true } | { ok: false; reason: string }

/**
 * 이동 로그의 형식 검사. 서버가 완료 제출을 받을 때 쓴다.
 * 링크가 실제로 그 문서에 있었는지는 여기서 보지 않는다(위키 문서가 필요하다).
 */
export function checkLog(puzzle: Puzzle, events: readonly MoveEvent[]): LogCheck {
  if (events.length === 0) return { ok: false, reason: 'empty' }
  const stack: Page[] = [puzzle.start]
  let prevAt = 0
  for (const [i, e] of events.entries()) {
    if (!Number.isFinite(e.at) || e.at < prevAt) return { ok: false, reason: `time_not_monotonic@${i}` }
    prevAt = e.at
    if (stack.at(-1)!.id === puzzle.end.id) return { ok: false, reason: `move_after_finish@${i}` }
    if (e.type === 'link') {
      stack.push(e.to)
    } else {
      if (stack.length < 2) return { ok: false, reason: `back_at_start@${i}` }
      stack.pop()
      if (stack.at(-1)!.id !== e.to.id) return { ok: false, reason: `back_target_mismatch@${i}` }
    }
  }
  const last = events.at(-1)!
  if (last.type !== 'link' || last.to.id !== puzzle.end.id) return { ok: false, reason: 'not_finished' }
  return { ok: true }
}

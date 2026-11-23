import { checkLog, type MoveEvent, type Puzzle, type RunMode } from '@linkle/core'

// 기록에 관한 규칙. DB도 요청도 모르는 순수 함수라 Worker 없이 테스트한다.

/**
 * 이동 한 번에 드는 최소 시간. 문서를 받고, 링크를 찾아 누르는 데 걸리는 시간보다 한참 짧게 잡았다.
 * 평균이 이보다 빠른 기록은 사람이 낸 것으로 보기 어렵다.
 */
export const MIN_MS_PER_MOVE = 500

/**
 * 기기가 잰 시간이 서버가 잰 시간보다 이만큼 넘게 길면 표시를 남긴다.
 * 기기의 시계 보정에는 네트워크 지연만큼의 오차가 있어서 조금 넘는 것은 정상이다.
 */
export const CLOCK_SLACK_MS = 5_000

/** 서버가 붙이는 표시. 표시가 있어도 기록은 받는다. 어제의 기록과 순위표 후보에서만 빠진다 */
export const FLAG_TIME_OVER = 'time_over'
export const FLAG_TOO_FAST = 'too_fast'

export type Settled = { durationMs: number; moves: number; flags: string[] }

/**
 * 완료 제출을 기록으로 확정한다.
 * 로그의 형식이 틀리면 받지 않고, 시간이 수상하면 거절하지 않고 표시만 남긴다.
 */
export function settle(input: {
  puzzle: Puzzle
  events: readonly MoveEvent[]
  /** 기기가 보낸 표시 (페이지 내 검색 등) */
  flags: readonly string[]
  startedAt: number
  /** 제출을 받은 서버 시각 */
  serverNow: number
}): { ok: true; value: Settled } | { ok: false; reason: string } {
  const check = checkLog(input.puzzle, input.events)
  if (!check.ok) return check

  const moves = input.events.length
  const clientMs = input.events.at(-1)!.at
  const serverMs = Math.max(0, input.serverNow - input.startedAt)
  // 소요 시간은 서버가 잰 경과 시간보다 길 수 없다. 짧은 것은 괜찮다: 제출이 늦게 올 수 있다(오프라인, 재시도)
  const durationMs = Math.min(clientMs, serverMs)

  const flags = new Set(input.flags)
  if (clientMs > serverMs + CLOCK_SLACK_MS) flags.add(FLAG_TIME_OVER)
  if (durationMs < moves * MIN_MS_PER_MOVE) flags.add(FLAG_TOO_FAST)

  return { ok: true, value: { durationMs, moves, flags: [...flags] } }
}

export type RunKind = { mode: RunMode; ranked: boolean }

/**
 * 이 문제를 지금 시작하면 어떤 Run이 되는지. 시작할 수 없는 문제면 null.
 * ranked는 "기록에 드는 판"이다: 오늘의 문제를 그날 푼 것, 커뮤니티 문제의 첫 도전.
 * (첫 도전인지는 DB의 유일 제약이 가린다. 여기서는 후보인지만 정한다)
 */
export function runKindFor(
  puzzle: { kind: Puzzle['kind']; date: string | null; status: string; authorId: string | null },
  today: string,
  playerId: string,
): RunKind | null {
  // 출제자가 아직 풀지 않은 문제(draft)는 출제자만 시작할 수 있다. 링크가 있는 사람만 푸는 문제(unlisted)는 누구나(설계 문서 16.4)
  const open = puzzle.status === 'published' || puzzle.status === 'unlisted' || (puzzle.status === 'draft' && puzzle.authorId === playerId)
  if (!open) return null
  if (puzzle.kind === 'daily') {
    if (puzzle.status !== 'published') return null
    // 아직 오지 않은 날의 문제는 없는 것으로 다룬다. 출발·도착이 미리 새면 안 된다
    if (puzzle.date === null || puzzle.date > today) return null
    return puzzle.date === today ? { mode: 'daily', ranked: true } : { mode: 'archive', ranked: false }
  }
  // 랜덤 풀은 같이 달리기의 문제라 순위표가 없다
  if (puzzle.kind === 'random') return { mode: 'community', ranked: false }
  // 출제자는 답을 알고 있으므로 순위에 들지 않는다
  return { mode: 'community', ranked: puzzle.authorId !== playerId }
}

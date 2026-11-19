import type { Puzzle, Run, RunMode } from '@linkle/core'
import { playerId } from './player'

// 서버(apps/worker)의 API를 부르는 곳. 응답의 모양은 설계 문서 3.8과 같다.

export type Today = { date: string; number: number; resetsAt: number; serverNow: number; finishedCount: number }
export type Started = { runId: string; startedAt: number; serverNow: number; mode: RunMode; puzzle: Puzzle }
/** order는 그 문제를 몇 번째로 끝냈는지. 기록에 들지 않는 판은 null */
export type Finished = { order: number | null; durationMs: number }

/** 서버를 기다리는 상한. 시작 버튼이 끝없이 돌지 않게 한다 */
const TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    /** HTTP 상태. 서버에 닿지 못했으면 0 */
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`)
  }

  /**
   * 나중에 다시 보내면 될 수 있는 실패인지. 연결 실패, 서버 오류, 한도 초과(429)가 그렇다.
   * 나머지 4xx는 요청 자체가 받아들여지지 않은 것이라 다시 보내도 같다.
   */
  get retryable(): boolean {
    return this.status < 400 || this.status >= 500 || this.status === 408 || this.status === 429
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ApiError(0, 'network')
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: unknown }) | null
  if (!res.ok) throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : 'unknown')
  // 200인데 JSON이 아니면 서버가 아닌 것이 답한 것이다(개발 중 프록시 등)
  if (data === null) throw new ApiError(0, 'bad_response')
  return data
}

export function getToday(): Promise<Today> {
  return call<Today>('/api/today')
}

/** 오늘의 문제를 시작한다. 출발·도착 문서는 여기서 처음 받는다. 다시 불러도 같은 판과 같은 시작 시각이 온다 */
export function startDaily(): Promise<Started> {
  return call<Started>('/api/runs', { playerId: playerId() })
}

/** 끝난 판을 서버에 알린다. 여러 번 보내도 처음 저장된 결과가 온다 */
export function finishRun(run: Run): Promise<Finished> {
  return call<Finished>(`/api/runs/${run.runId}/finish`, { playerId: playerId(), events: run.events, emoji: run.emoji, flags: run.flags })
}

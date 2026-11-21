import { stackOf, type MoveEvent, type Page } from '@linkle/core'
import { ApiError } from './api'

// 관리자 화면이 부르는 API(apps/worker/src/admin.ts). 로그인하면 서버가 쿠키를 주고, 이후 요청은 그 쿠키로 들어간다.

export type { Difficulty } from '@linkle/core'
import type { Difficulty } from '@linkle/core'
export type Hop = { id: number; title: string; via: string }

export type AdminDay = {
  id: number
  date: string
  number: number
  start_title: string
  end_title: string
  difficulty: Difficulty | null
  par: number | null
  plays: number
  clears: number
  solution: string | null
}
export type Overview = {
  today: string
  days: AdminDay[]
  /** 대기열의 난이도별 수. unreviewed는 그중 아직 안 본 문제 */
  queue: { difficulty: Difficulty | null; n: number; unreviewed: number }[]
  community: { n: number; plays: number | null; clears: number | null } | null
  players: number
  /** 대기열이 below개 아래로 줄면 Worker가 문제 채우기를 부른다. last는 마지막으로 부른 결과 */
  refill: { last: { at: number; ok: boolean; status: number; left: number } | null; below: number; canDispatch: boolean }
}
export type QueueItem = {
  id: number
  start_id: number
  start_title: string
  end_id: number
  end_title: string
  par: number
  difficulty: Difficulty | null
  solution: string | null
  priority: number
  created_at: number
  /** 관리자가 봤다고 남긴 때. 비어 있으면 안 본 문제 */
  reviewed_at: number | null
}
/** 날짜가 붙은 오늘의 문제(최근 30일과 앞으로) */
export type PlacedDay = {
  id: number
  date: string
  number: number
  start_id: number
  start_title: string
  end_id: number
  end_title: string
  difficulty: Difficulty | null
  par: number | null
  plays: number
  solution: string | null
}
export type QueueData = { today: string; approved: QueueItem[]; rejected: RejectedItem[]; placed: PlacedDay[] }
export type QueueAction = 'reject' | 'restore' | 'first' | 'unpin' | 'ok' | 'unreview'
export type RejectedItem = { id: number; start_title: string; end_title: string; par: number; difficulty: Difficulty | null; note: string | null }
export type CommunityItem = { id: number; number: number; start_title: string; end_title: string; par: number | null; difficulty: Difficulty | null; status: string; plays: number; clears: number; solution: string | null }
export type NewPuzzle = { start: Page; end: Page; par: number; difficulty: Difficulty; solution: Hop[] }

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/admin/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new ApiError(0, 'network')
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: unknown }) | null
  if (!res.ok) throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : 'unknown')
  if (data === null) throw new ApiError(0, 'bad_response')
  return data
}

export const adminApi = {
  me: () => call<{ ok: true }>('me'),
  login: (password: string) => call<{ ok: true }>('login', { password }),
  logout: () => call<{ ok: true }>('logout', {}),
  overview: () => call<Overview>('overview'),
  queue: () => call<QueueData>('queue'),
  queueAction: (id: number, action: QueueAction) => call<{ ok: true }>(`queue/${id}`, { action }),
  community: () => call<{ items: CommunityItem[] }>('community'),
  refill: () => call<{ at: number; ok: boolean; status: number; left: number }>('refill', {}),
  puzzleAction: (id: number, action: 'hide' | 'show' | 'replace') => call<{ ok: true }>(`puzzles/${id}`, { action }),
  // 관리자가 직접 풀어 넣은 문제는 이미 본 문제다
  add: (pool: 'daily' | 'official', item: NewPuzzle, first: boolean) => call<{ added: number; queue: number }>('puzzles', { pool, items: [item], first, reviewed: true }),
}

/**
 * 관리자가 푼 판에서 정답 경로를 뽑는다. 되돌아간 곳은 지우고, 도착까지 남은 길만 남긴다.
 * 각 칸의 via는 그 문서로 갈 때 누른 링크의 이름이다(넘겨주기 전 이름). 서버가 이걸로 경로를 다시 확인한다.
 */
export function solutionOf(start: Page, events: MoveEvent[]): Hop[] {
  const hops: Hop[] = []
  for (const e of events) {
    if (e.type === 'link') hops.push({ id: e.to.id, title: e.to.title, via: e.via })
    else hops.pop()
  }
  // stackOf와 같은 길이어야 한다(출발 문서 하나가 더 있다)
  if (stackOf(start, events).length !== hops.length + 1) throw new Error('path mismatch')
  return hops
}

/** 이동 수로 짐작하는 난이도. 관리자가 바꿀 수 있다 */
export const guessDifficulty = (moves: number): Difficulty => (moves <= 3 ? 'easy' : moves === 4 ? 'normal' : 'hard')

/** 관리자가 연습으로 푸는 판의 자리와 runId 머리. 서버로 보내지 않는다 */
export const ADMIN_SLOT = -1
export const ADMIN_RUN_PREFIX = 'admin-'

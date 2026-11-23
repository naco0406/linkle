import type { Ghost, Puzzle, Rules, Run, RunMode, Yesterday } from '@linkle/core'
import { playerId, playerSalt } from './player'

// 서버(apps/worker)의 API를 부르는 곳. 응답의 모양은 설계 문서 3.8과 같다.

export type Today = { date: string; number: number; resetsAt: number; serverNow: number; finishedCount: number }
export type Started = { runId: string; startedAt: number; serverNow: number; mode: RunMode; puzzle: Puzzle; ghost?: Ghost | null }
/** order는 그 문제를 몇 번째로 끝냈는지. 기록에 들지 않는 판은 null */
export type Finished = { order: number | null; durationMs: number; rank?: number | null }

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
  return call<Started>('/api/runs', { playerId: playerId(), salt: playerSalt() })
}

/** 끝난 판을 서버에 알린다. 여러 번 보내도 처음 저장된 결과가 온다 */
export function finishRun(run: Run): Promise<Finished> {
  return call<Finished>(`/api/runs/${run.runId}/finish`, { playerId: playerId(), events: run.events, emoji: run.emoji, flags: run.flags })
}

/** 어제의 기록. 자정이 지나고 몇 분 동안은 모으는 중이다 */
export function getYesterday(): Promise<Yesterday> {
  return call<Yesterday>('/api/yesterday')
}

// ── 지난 문제와 커뮤니티 ──

export type ArchiveItem = { id: number; number: number; date: string; finished: number }
export type PuzzleCard = { id: number; kind: Puzzle['kind']; number: number; author: string; plays: number; clears: number; difficulty: 'easy' | 'normal' | 'hard' | null }
export type PuzzleInfo = PuzzleCard & { date: string | null; medianMoves: number | null }
export type BoardRow = { rank: number; name: string; moves: number; ms: number; verified: boolean; me: boolean }
export type Board = { top: BoardRow[]; me: BoardRow | null; total: number }
export type Page<T> = { items: T[]; next: number | null }
export type CommunitySort = 'new' | 'popular' | 'hard'

export const getArchive = (before: number | null) => call<Page<ArchiveItem>>(`/api/archive${before ? `?before=${before}` : ''}`)
export const getCommunity = (sort: CommunitySort, offset: number) => call<Page<PuzzleCard>>(`/api/community?sort=${sort}&offset=${offset}`)
export const getPuzzle = (id: number) => call<PuzzleInfo>(`/api/puzzles/${id}`)
export const getBoard = (id: number) => call<Board>(`/api/puzzles/${id}/board?playerId=${playerId()}`)
export const getDay = (date: string) => call<Yesterday>(`/api/days/${date}`)

/** 지난 문제나 커뮤니티 문제를 시작한다. 커뮤니티 문제는 처음 도전만 순위에 든다 */
export function startPuzzle(puzzleId: number, challenge?: string): Promise<Started> {
  return call<Started>('/api/runs', { playerId: playerId(), puzzleId, salt: playerSalt(), ...(challenge ? { challenge } : {}) })
}

// ── 친구와 겨루기(설계 문서 16장) ──

export type Step = { id: number; title: string; emoji: string | null; back: boolean }
export type ChallengeRow = { name: string; ms: number; moves: number; me: boolean; sender: boolean }
export type Challenge = {
  code: string
  byAuthor: boolean
  puzzle: { id: number; kind: Puzzle['kind']; number: number; difficulty: 'easy' | 'normal' | 'hard' | null }
  sender: { name: string; ms: number; moves: number; emoji: string[] | null }
  takers: number
  board: ChallengeRow[]
  compare: { mine: { ms: number; moves: number; path: Step[] }; theirs: { path: Step[] } } | null
}

/** 끝낸 판으로 도전장을 만든다. 같은 판이면 같은 코드가 온다 */
export const makeChallenge = (runId: string) => call<{ code: string }>('/api/challenges', { playerId: playerId(), runId })
export const getChallenge = (code: string) => call<Challenge>(`/api/challenges/${code}?playerId=${playerId()}`)
export const renamePlayer = (salt: number) => call<{ name: string }>('/api/players/name', { playerId: playerId(), salt })

export type MineRow = {
  id: number
  number: number
  status: 'draft' | 'unlisted' | 'published'
  start_title: string
  end_title: string
  author_moves: number | null
  plays: number
  clears: number
  shorter: number
  created_at: number
  canPublish: boolean
  solution: { id: number; title: string }[]
}
export const getMine = () => call<{ items: MineRow[] }>(`/api/mine?playerId=${playerId()}`)
export const makePuzzle = (start: { id: number; title: string }, end: { id: number; title: string }) =>
  call<{ puzzleId: number }>('/api/community/new', { playerId: playerId(), salt: playerSalt(), start, end })
export const publishPuzzle = (id: number) => call<{ ok: true }>(`/api/puzzles/${id}/publish`, { playerId: playerId() })
export const reportPuzzle = (id: number) => call<{ hidden: boolean }>(`/api/puzzles/${id}/report`, { playerId: playerId() })
export const createRoom = () => call<{ code: string }>('/api/rooms', {})
export type RoomInfo = { code: string; status: string; players: number; joinable: boolean; full: boolean; host: string | null; names: string[]; rules: Rules }
export const getRoom = (code: string) => call<RoomInfo>(`/api/rooms/${code}`)

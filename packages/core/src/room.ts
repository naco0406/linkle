import { LEVEL_EMOJI } from './emoji.ts'
import type { Puzzle } from './types.ts'

// 같이 달리기 방의 메시지(설계 문서 16.3, 16.5). Worker의 방(Durable Object)과 웹이 함께 쓴다.
// 모양 검사도 여기 한 곳에 둔다. 사용자가 쓴 글은 하나도 오가지 않는다: 이름은 자동, 반응은 정해진 여섯 개.

export const ROOM_PROTOCOL = 1
/** 헷갈리는 0·O·1·I·L을 뺀 31글자(usagi-volleyball과 같다) */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 4
export const MAX_RACERS = 8
/** 정원을 넘은 사람은 지켜보기로 받는다. 지켜보는 사람의 상한 */
export const MAX_SPECTATORS = 12
export const REACTIONS = ['👏', '😱', '🤔', '🔥', '😭', '🐢'] as const
export type Reaction = (typeof REACTIONS)[number]
/** 반응을 보낼 수 있는 간격 */
export const REACTION_GAP_MS = 1000
/**
 * 시작을 누른 뒤 출발 릴이 멈추는 때, 도착 릴이 멈추는 때, 출발하는 때(ms). 그사이 기기는 출발 문서를 받아 둔다.
 * 두 릴은 함께 돌기 시작해 출발 릴이 먼저 멈추고, 도착 릴은 한 박자 더 끌다 멈춘다. 마지막 3초가 3, 2, 1이다
 */
export const REVEAL = { start: 3200, end: 4800, go: 9800 } as const
/** 방장이 다시 돌릴 수 있는 마지막 순간(출발 전 ms) */
export const RESPIN_BEFORE_GO_MS = 1500
export const LIMIT_MINUTES = [5, 10, 15, 0] as const
export const DEFAULT_LIMIT = 10
/** 끊긴 사람의 자리를 지켜 주는 시간 */
export const SEAT_HOLD_MS = 2 * 60 * 1000

export const normalizeRoomCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isRoomCode = (s: string) => s.length === ROOM_CODE_LENGTH && [...s].every(c => ROOM_CODE_ALPHABET.includes(c))

import type { Difficulty } from './schedule.ts'

export type Source = 'random' | 'community' | 'archive' | 'mine'
export type WinRule = 'first' | 'fewest'
export type Rules = { source: Source; difficulty: Difficulty | null; puzzleId: number | null; win: WinRule; limit: number }
export const DEFAULT_RULES: Rules = { source: 'random', difficulty: 'normal', puzzleId: null, win: 'first', limit: DEFAULT_LIMIT }

export type RoomStatus = 'lobby' | 'reveal' | 'racing' | 'results'
/** player: 달린다. watch: 출제자라 지켜본다(문서 이름이 보인다). spectator: 정원이 차서 지켜본다(이름은 안 보인다) */
export type Role = 'player' | 'watch' | 'spectator'
/** 달리는 중의 상태 */
export type RacerState = 'idle' | 'move' | 'back' | 'arrived' | 'gaveup' | 'stopped'

export type SeatView = {
  seat: number
  name: string
  role: Role
  ready: boolean
  connected: boolean
  host: boolean
  /** 이 문제를 이미 풀어 봤는지(방장이 고른 문제 기준) */
  solved: boolean
  wins: number
}
export type Progress = { seat: number; moves: number; state: RacerState; level: number | null; away: boolean }
export type Arrival = { seat: number; ms: number; moves: number }
/** 결과 한 줄. 도착 못 한 사람은 ms가 null이고 그때 있던 문서와 색 */
export type ResultRow = { seat: number; name: string; ms: number | null; moves: number; level: number | null; title: string | null; state: RacerState }
export type PuzzleCardLite = { id: number; kind: Puzzle['kind']; number: number; difficulty: Difficulty | null }

export type RoomView = {
  code: string
  status: RoomStatus
  round: number
  rules: Rules
  seats: SeatView[]
  /** 고른 문제의 카드(출발·도착 없음). 랜덤은 시작 전까지 null */
  picked: PuzzleCardLite | null
}

export type LogEntry = { title: string; at: number; level: number | null; back: boolean }

// ── 기기 → 방 ──
export type ClientMessage =
  | { t: 'hello'; v: number; playerId: string; salt: number; token?: string; solved?: number[]; progress?: Omit<Progress, 'seat' | 'away'> }
  | { t: 'ready'; ready: boolean }
  | { t: 'rules'; rules: Partial<Rules> }
  | { t: 'start' }
  | { t: 'respin' }
  | { t: 'move'; moves: number; back: boolean; level: number | null; title: string; at: number }
  | { t: 'arrive'; moves: number; at: number; pageId: number }
  | { t: 'giveup' }
  | { t: 'away'; away: boolean }
  | { t: 'react'; id: Reaction }
  | { t: 'log'; round: number; entries: LogEntry[] }
  | { t: 'kick'; seat: number }
  | { t: 'again' }
  | { t: 'leave' }

// ── 방 → 기기 ──
export type ServerMessage =
  | { t: 'welcome'; seat: number; token: string; room: RoomView; serverNow: number }
  | { t: 'room'; room: RoomView }
  | { t: 'start'; round: number; puzzle: Puzzle; seed: number; revealAt: number; startsAt: number; endsAt: number | null; runId: string | null; serverNow: number }
  | { t: 'progress'; list: Progress[] }
  | { t: 'arrived'; arrival: Arrival }
  | { t: 'watch'; seat: number; title: string; moves: number; level: number | null }
  | { t: 'react'; seat: number; id: Reaction }
  | { t: 'ended'; round: number; reason: 'first' | 'all' | 'time'; results: ResultRow[] }
  | { t: 'log'; seat: number; round: number; entries: LogEntry[] }
  | { t: 'error'; code: RoomError }

export type RoomError = 'bad_request' | 'version' | 'not_found' | 'full' | 'kicked' | 'replaced' | 'not_host' | 'bad_state' | 'no_puzzle' | 'not_enough'

export const ERROR_TEXT: Record<RoomError, string> = {
  bad_request: '알 수 없는 요청이에요.',
  version: '앱이 새로 나왔어요. 새로고침해 주세요.',
  not_found: '없는 방이거나 벌써 닫힌 방이에요.',
  full: '방이 꽉 찼어요.',
  kicked: '방장이 방에서 내보냈어요.',
  replaced: '다른 탭이나 기기에서 이 자리로 들어왔어요.',
  not_host: '방장만 할 수 있어요.',
  bad_state: '지금은 할 수 없어요.',
  no_puzzle: '낼 문제를 찾지 못했어요. 다른 난이도나 문제를 골라 주세요.',
  not_enough: '준비한 사람이 2명 넘어야 출발할 수 있어요.',
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isLevel = (v: unknown): v is number | null => v === null || isInt(v, 0, LEVEL_EMOJI.length - 1)
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseRules(raw: unknown): Partial<Rules> | null {
  if (!isRecord(raw)) return null
  const out: Partial<Rules> = {}
  if (raw.source !== undefined) {
    if (!['random', 'community', 'archive', 'mine'].includes(raw.source as string)) return null
    out.source = raw.source as Source
  }
  if (raw.difficulty !== undefined) {
    if (raw.difficulty !== null && !['easy', 'normal', 'hard'].includes(raw.difficulty as string)) return null
    out.difficulty = raw.difficulty as Difficulty | null
  }
  if (raw.puzzleId !== undefined) {
    if (raw.puzzleId !== null && !isInt(raw.puzzleId, 1, 2 ** 31)) return null
    out.puzzleId = raw.puzzleId as number | null
  }
  if (raw.win !== undefined) {
    if (raw.win !== 'first' && raw.win !== 'fewest') return null
    out.win = raw.win
  }
  if (raw.limit !== undefined) {
    if (!(LIMIT_MINUTES as readonly number[]).includes(raw.limit as number)) return null
    out.limit = raw.limit as number
  }
  return out
}

function parseLog(raw: unknown): LogEntry[] | null {
  if (!Array.isArray(raw) || raw.length > 200) return null
  const out: LogEntry[] = []
  for (const e of raw) {
    if (!isRecord(e) || !isTitle(e.title) || !isInt(e.at, 0, 24 * 3600_000) || !isLevel(e.level) || typeof e.back !== 'boolean') return null
    out.push({ title: e.title, at: e.at, level: e.level, back: e.back })
  }
  return out
}

/** 방이 받는 메시지를 검사해 알려진 칸만 남긴다. 모양이 틀리면 null */
export function parseClientMessage(text: string): ClientMessage | null {
  if (text.length > 32_000) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(raw)) return null
  switch (raw.t) {
    case 'hello': {
      if (!isInt(raw.v, 0, 1000) || typeof raw.playerId !== 'string' || !UUID.test(raw.playerId) || !isInt(raw.salt ?? 0, 0, 1_000_000)) return null
      if (raw.token !== undefined && (typeof raw.token !== 'string' || raw.token.length > 64)) return null
      const solved = Array.isArray(raw.solved) ? raw.solved.filter(x => isInt(x, 1, 2 ** 31)).slice(0, 200) : []
      let progress: Omit<Progress, 'seat' | 'away'> | undefined
      if (isRecord(raw.progress) && isInt(raw.progress.moves, 0, 500) && isLevel(raw.progress.level) && ['idle', 'move', 'back', 'arrived', 'gaveup', 'stopped'].includes(raw.progress.state as string))
        progress = { moves: raw.progress.moves, level: raw.progress.level, state: raw.progress.state as RacerState }
      return { t: 'hello', v: raw.v, playerId: raw.playerId.toLowerCase(), salt: (raw.salt as number | undefined) ?? 0, token: raw.token as string | undefined, solved, progress }
    }
    case 'ready':
      return typeof raw.ready === 'boolean' ? { t: 'ready', ready: raw.ready } : null
    case 'rules': {
      const rules = parseRules(raw.rules)
      return rules ? { t: 'rules', rules } : null
    }
    case 'move':
      return isInt(raw.moves, 0, 500) && typeof raw.back === 'boolean' && isLevel(raw.level) && isTitle(raw.title) && isInt(raw.at, 0, 24 * 3600_000)
        ? { t: 'move', moves: raw.moves, back: raw.back, level: raw.level, title: raw.title, at: raw.at }
        : null
    case 'arrive':
      return isInt(raw.moves, 1, 500) && isInt(raw.at, 0, 24 * 3600_000) && isInt(raw.pageId, 1, 2 ** 31) ? { t: 'arrive', moves: raw.moves, at: raw.at, pageId: raw.pageId } : null
    case 'away':
      return typeof raw.away === 'boolean' ? { t: 'away', away: raw.away } : null
    case 'react':
      return (REACTIONS as readonly string[]).includes(raw.id as string) ? { t: 'react', id: raw.id as Reaction } : null
    case 'log': {
      const entries = parseLog(raw.entries)
      return entries && isInt(raw.round, 1, 100_000) ? { t: 'log', round: raw.round, entries } : null
    }
    case 'kick':
      return isInt(raw.seat, 0, 100) ? { t: 'kick', seat: raw.seat } : null
    case 'start':
    case 'respin':
    case 'giveup':
    case 'again':
    case 'leave':
      return { t: raw.t }
    default:
      return null
  }
}

/**
 * 결과 줄 세우기(16.3.6).
 * 먼저 도착: 도착한 사람(빠른 순) 다음에, 도착 못 한 사람은 마지막 문서의 색이 가까운 순, 같으면 이동이 적은 순.
 * 적은 이동: 도착한 사람은 이동이 적은 순, 같으면 빠른 순. 도착 못 한 사람은 위와 같다.
 */
export function rankResults(rows: ResultRow[], win: WinRule): ResultRow[] {
  const arrived = rows.filter(r => r.ms !== null)
  const rest = rows.filter(r => r.ms === null)
  arrived.sort((a, b) => (win === 'fewest' ? a.moves - b.moves || a.ms! - b.ms! : a.ms! - b.ms! || a.moves - b.moves))
  rest.sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || a.moves - b.moves || a.seat - b.seat)
  return [...arrived, ...rest]
}



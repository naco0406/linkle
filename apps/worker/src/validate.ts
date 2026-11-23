import { BACK_EMOJI, GOAL_EMOJI, LEVEL_EMOJI, UNKNOWN_EMOJI, type MoveEvent, type Page } from '@linkle/core'

// 요청 본문의 모양 검사. 여기를 통과한 값만 DB와 도메인 함수로 간다.
// 순수 함수라 Worker 없이 테스트한다.

export const LIMITS = {
  /** 이동 500번의 로그가 넉넉히 들어가는 크기. 보통 한 판은 1~2 KB다 */
  bodyBytes: 100_000,
  events: 500,
  /** 위키백과 제목의 상한(255바이트)보다 길 수 없다 */
  title: 255,
  flags: 16,
} as const

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): Parsed<never> => ({ ok: false, error })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FLAG = /^[a-z0-9_]{1,24}$/
const EMOJI: ReadonlySet<string> = new Set([...LEVEL_EMOJI, BACK_EMOJI, GOAL_EMOJI, UNKNOWN_EMOJI])

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= LIMITS.title

export type StartBody = { playerId: string; puzzleId: number | null; challenge: string | null; salt: number }

const CODE = /^[A-Z2-9]{6}$/

export function parseStartBody(body: unknown): Parsed<StartBody> {
  if (!isRecord(body)) return fail('invalid_body')
  if (!isUuid(body.playerId)) return fail('invalid_player')
  const puzzleId = body.puzzleId ?? null
  if (puzzleId !== null && !isId(puzzleId)) return fail('invalid_puzzle')
  // 도전장으로 시작하는 판(설계 문서 16.2)
  const challenge = body.challenge ?? null
  if (challenge !== null && (typeof challenge !== 'string' || !CODE.test(challenge))) return fail('invalid_challenge')
  const salt = parseSalt(body.salt)
  if (salt === null) return fail('invalid_salt')
  return { ok: true, value: { playerId: body.playerId.toLowerCase(), puzzleId, challenge, salt } }
}

/** 이름 다시 뽑기의 숫자. 없으면 0 */
export function parseSalt(v: unknown): number | null {
  if (v === undefined || v === null) return 0
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000 ? v : null
}

/** 출제: 고른 두 문서 */
export function parseMakeBody(body: unknown): Parsed<{ playerId: string; start: Page; end: Page; salt: number }> {
  if (!isRecord(body)) return fail('invalid_body')
  if (!isUuid(body.playerId)) return fail('invalid_player')
  const start = parsePage(body.start)
  const end = parsePage(body.end)
  if (!start || !end || start.id === end.id) return fail('invalid_pages')
  const salt = parseSalt(body.salt)
  if (salt === null) return fail('invalid_salt')
  return { ok: true, value: { playerId: body.playerId.toLowerCase(), start, end, salt } }
}

export type FinishBody = { playerId: string; events: MoveEvent[]; emoji: string[] | null; flags: string[] }

export function parseFinishBody(body: unknown): Parsed<FinishBody> {
  if (!isRecord(body)) return fail('invalid_body')
  if (!isUuid(body.playerId)) return fail('invalid_player')

  if (!Array.isArray(body.events)) return fail('invalid_events')
  if (body.events.length > LIMITS.events) return fail('too_many_events')
  const events: MoveEvent[] = []
  for (const raw of body.events) {
    const e = parseEvent(raw)
    if (!e) return fail('invalid_events')
    events.push(e)
  }

  const flags = body.flags ?? []
  if (!Array.isArray(flags) || flags.length > LIMITS.flags) return fail('invalid_flags')
  if (!flags.every((f): f is string => typeof f === 'string' && FLAG.test(f))) return fail('invalid_flags')

  return { ok: true, value: { playerId: body.playerId.toLowerCase(), events, emoji: parseEmoji(body.emoji, events.length), flags } }
}

/** 알려진 칸만 골라 새로 만든다. 본문에 딸려 온 다른 값이 DB에 저장되지 않게 한다 */
function parseEvent(raw: unknown): MoveEvent | null {
  if (!isRecord(raw)) return null
  const to = parsePage(raw.to)
  const at = raw.at
  if (!to || typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > Number.MAX_SAFE_INTEGER) return null
  if (raw.type === 'back') return { type: 'back', to, at: Math.round(at) }
  if (raw.type === 'link' && isTitle(raw.via)) return { type: 'link', to, via: raw.via, at: Math.round(at) }
  return null
}

function parsePage(raw: unknown): Page | null {
  return isRecord(raw) && isId(raw.id) && isTitle(raw.title) ? { id: raw.id, title: raw.title } : null
}

/**
 * 이모지는 표시용이라 모양이 틀리면 버리기만 하고 제출은 받는다.
 * 정해진 이모지만 받는 이유는, 사용자가 쓴 글이 서버에 한 글자도 남지 않게 하려는 것이다.
 */
function parseEmoji(raw: unknown, moves: number): string[] | null {
  if (!Array.isArray(raw) || raw.length !== moves) return null
  return raw.every((x): x is string => typeof x === 'string' && EMOJI.has(x)) ? raw : null
}

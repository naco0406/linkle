import { describe, expect, it } from 'vitest'
import { isUuid, LIMITS, parseFinishBody, parseStartBody } from './validate.ts'

const ID = '0b9f6c1e-7a52-4d0b-9c3e-5f2a1d8e4b77'
const link = (id: number, title: string, at: number) => ({ type: 'link', to: { id, title }, via: title, at })
const good = { playerId: ID, events: [link(2, '소고기', 1500), { type: 'back', to: { id: 1, title: '불고기' }, at: 3000 }], emoji: ['🟥', '⏪'], flags: ['find'] }
const errorOf = (body: unknown) => {
  const r = parseFinishBody(body)
  return r.ok ? null : r.error
}

describe('기기 id', () => {
  it('UUID 모양만 받는다', () => {
    expect(isUuid(ID)).toBe(true)
    expect(isUuid(ID.toUpperCase())).toBe(true)
    expect(isUuid('player-1')).toBe(false)
    expect(isUuid(ID + '0')).toBe(false)
    expect(isUuid(123)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})

describe('시작 요청', () => {
  it('puzzleId가 없으면 오늘의 문제다', () => {
    expect(parseStartBody({ playerId: ID })).toEqual({ ok: true, value: { playerId: ID, puzzleId: null } })
    expect(parseStartBody({ playerId: ID, puzzleId: null })).toEqual({ ok: true, value: { playerId: ID, puzzleId: null } })
  })

  it('기기 id는 소문자로 맞춘다', () => {
    expect(parseStartBody({ playerId: ID.toUpperCase(), puzzleId: 7 })).toEqual({ ok: true, value: { playerId: ID, puzzleId: 7 } })
  })

  it('모양이 틀리면 받지 않는다', () => {
    expect(parseStartBody(null)).toEqual({ ok: false, error: 'invalid_body' })
    expect(parseStartBody([])).toEqual({ ok: false, error: 'invalid_body' })
    expect(parseStartBody({})).toEqual({ ok: false, error: 'invalid_player' })
    expect(parseStartBody({ playerId: 'abc' })).toEqual({ ok: false, error: 'invalid_player' })
    for (const puzzleId of ['1', 0, -3, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseStartBody({ playerId: ID, puzzleId })).toEqual({ ok: false, error: 'invalid_puzzle' })
    }
  })
})

describe('완료 제출', () => {
  it('바른 본문을 받는다', () => {
    expect(parseFinishBody(good)).toEqual({ ok: true, value: good })
  })

  it('알려진 칸만 남긴다', () => {
    const r = parseFinishBody({ ...good, extra: 1, events: [{ ...link(2, '소고기', 1500.4), html: '<b>', to: { id: 2, title: '소고기', note: 'x' } }] , emoji: ['🟥'] })
    expect(r).toEqual({ ok: true, value: { ...good, events: [link(2, '소고기', 1500)], emoji: ['🟥'] } })
  })

  it('flags는 없어도 된다', () => {
    const r = parseFinishBody({ playerId: ID, events: good.events, emoji: null })
    expect(r.ok && r.value.flags).toEqual([])
  })

  it('기기 id와 본문의 모양을 본다', () => {
    expect(errorOf('x')).toBe('invalid_body')
    expect(errorOf({ ...good, playerId: 'me' })).toBe('invalid_player')
  })

  it('이동 로그의 칸마다 형식을 본다', () => {
    const bad = (event: unknown) => errorOf({ ...good, events: [event], emoji: null })
    expect(errorOf({ ...good, events: 'none' })).toBe('invalid_events')
    expect(bad(null)).toBe('invalid_events')
    expect(bad({ ...link(2, '소고기', 10), type: 'jump' })).toBe('invalid_events')
    expect(bad({ ...link(2, '소고기', 10), via: '' })).toBe('invalid_events')
    expect(bad({ ...link(2, '소고기', 10), via: undefined })).toBe('invalid_events')
    expect(bad(link(0, '소고기', 10))).toBe('invalid_events')
    expect(bad(link(2.5, '소고기', 10))).toBe('invalid_events')
    expect(bad(link(2, '', 10))).toBe('invalid_events')
    expect(bad(link(2, '가'.repeat(LIMITS.title + 1), 10))).toBe('invalid_events')
    expect(bad(link(2, '소고기', -1))).toBe('invalid_events')
    expect(bad(link(2, '소고기', Number.NaN))).toBe('invalid_events')
    expect(bad(link(2, '소고기', Number.POSITIVE_INFINITY))).toBe('invalid_events')
    expect(bad({ ...link(2, '소고기', 10), at: '10' })).toBe('invalid_events')
    expect(bad({ type: 'back', at: 10 })).toBe('invalid_events')
    expect(bad(link(2, '가'.repeat(LIMITS.title), 10))).toBeNull()
  })

  it('이동이 너무 많으면 받지 않는다', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => link(i + 2, `문서 ${i}`, i))
    expect(errorOf({ ...good, events: many(LIMITS.events + 1), emoji: null })).toBe('too_many_events')
    expect(errorOf({ ...good, events: many(LIMITS.events), emoji: null })).toBeNull()
  })

  it('표시는 짧은 영문 이름만 받는다', () => {
    expect(errorOf({ ...good, flags: 'find' })).toBe('invalid_flags')
    expect(errorOf({ ...good, flags: ['Find'] })).toBe('invalid_flags')
    expect(errorOf({ ...good, flags: ['a,b'] })).toBe('invalid_flags')
    expect(errorOf({ ...good, flags: [1] })).toBe('invalid_flags')
    expect(errorOf({ ...good, flags: Array.from({ length: LIMITS.flags + 1 }, (_, i) => `f${i}`) })).toBe('invalid_flags')
  })

  it('이모지는 표시용이라 틀리면 버리기만 한다', () => {
    const emojiOf = (emoji: unknown) => {
      const r = parseFinishBody({ ...good, emoji })
      return r.ok ? r.value.emoji : 'rejected'
    }
    expect(emojiOf(['🟦', '🏁'])).toEqual(['🟦', '🏁'])
    expect(emojiOf(['⬜', '⏪'])).toEqual(['⬜', '⏪'])
    expect(emojiOf(null)).toBeNull()
    expect(emojiOf(undefined)).toBeNull()
    expect(emojiOf('🟥⏪')).toBeNull()
    expect(emojiOf(['🟥'])).toBeNull() // 이동 횟수와 개수가 다르다
    expect(emojiOf(['🟥', '<script>'])).toBeNull()
    expect(emojiOf(['🟥', 7])).toBeNull()
  })
})

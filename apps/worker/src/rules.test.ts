import { describe, expect, it } from 'vitest'
import type { MoveEvent, Puzzle } from '@linkle/core'
import { CLOCK_SLACK_MS, FLAG_TIME_OVER, FLAG_TOO_FAST, MIN_MS_PER_MOVE, runKindFor, settle } from './rules.ts'

const P = (id: number, title: string) => ({ id, title })
const A = P(1, '불고기'), B = P(2, '소고기'), C = P(3, '가죽'), E = P(5, '뉴발란스')
const puzzle: Puzzle = { id: 10, kind: 'daily', number: 1, date: '2026-11-19', start: A, end: E }
const T0 = Date.UTC(2026, 10, 19, 3, 0, 0)

const link = (to: typeof A, at: number): MoveEvent => ({ type: 'link', to, via: to.title, at })
const back = (to: typeof A, at: number): MoveEvent => ({ type: 'back', to, at })
/** A → B → C → (뒤로) B → E, 40초 */
const events = [link(B, 5_000), link(C, 12_000), back(B, 20_000), link(E, 40_000)]

const run = (over: Partial<Parameters<typeof settle>[0]> = {}) =>
  settle({ puzzle, events, flags: [], startedAt: T0, serverNow: T0 + 40_300, ...over })

describe('완료 제출 확정', () => {
  it('정상 기록은 기기가 잰 시간을 그대로 쓰고 표시가 없다', () => {
    expect(run()).toEqual({ ok: true, value: { durationMs: 40_000, moves: 4, flags: [] } })
  })

  it('제출이 늦게 와도(오프라인, 재시도) 기기가 잰 시간을 쓴다', () => {
    expect(run({ serverNow: T0 + 3_600_000 })).toEqual({ ok: true, value: { durationMs: 40_000, moves: 4, flags: [] } })
  })

  it('소요 시간은 서버가 잰 경과 시간보다 길 수 없다', () => {
    // 시계 오차 범위 안: 줄이기만 하고 표시는 없다
    expect(run({ serverNow: T0 + 39_000 })).toEqual({ ok: true, value: { durationMs: 39_000, moves: 4, flags: [] } })
  })

  it('기기 시간이 서버 시간보다 한참 길면 줄이고 표시를 남긴다', () => {
    const r = run({ serverNow: T0 + 40_000 - CLOCK_SLACK_MS - 1 })
    expect(r).toEqual({ ok: true, value: { durationMs: 40_000 - CLOCK_SLACK_MS - 1, moves: 4, flags: [FLAG_TIME_OVER] } })
  })

  it('서버 시각이 시작보다 앞서면 0으로 본다', () => {
    const r = run({ serverNow: T0 - 1_000 })
    expect(r.ok && r.value.durationMs).toBe(0)
  })

  it('이동 한 번의 평균 시간이 최소보다 짧으면 표시를 남긴다', () => {
    const fast = [link(B, 100), link(C, 200), link(E, 3 * MIN_MS_PER_MOVE - 1)]
    expect(run({ events: fast })).toEqual({ ok: true, value: { durationMs: 3 * MIN_MS_PER_MOVE - 1, moves: 3, flags: [FLAG_TOO_FAST] } })
    const ok = [link(B, 100), link(C, 200), link(E, 3 * MIN_MS_PER_MOVE)]
    expect(run({ events: ok })).toEqual({ ok: true, value: { durationMs: 3 * MIN_MS_PER_MOVE, moves: 3, flags: [] } })
  })

  it('서버 시간으로 줄인 뒤의 값으로 빠르기를 본다', () => {
    // 시작 1초 뒤에 "40초 걸렸다"는 4번 이동 기록이 왔다
    const r = run({ serverNow: T0 + 1_000 })
    expect(r).toEqual({ ok: true, value: { durationMs: 1_000, moves: 4, flags: [FLAG_TIME_OVER, FLAG_TOO_FAST] } })
  })

  it('기기가 보낸 표시는 그대로 두고, 같은 표시를 두 번 넣지 않는다', () => {
    const r = run({ flags: ['find', FLAG_TOO_FAST, 'find'], events: [link(E, 10)] })
    expect(r).toEqual({ ok: true, value: { durationMs: 10, moves: 1, flags: ['find', FLAG_TOO_FAST] } })
  })

  it('형식이 틀린 로그는 받지 않는다', () => {
    expect(run({ events: [] })).toEqual({ ok: false, reason: 'empty' })
    expect(run({ events: [link(B, 1_000), link(C, 2_000)] })).toEqual({ ok: false, reason: 'not_finished' })
    expect(run({ events: [link(B, 2_000), link(E, 1_000)] })).toEqual({ ok: false, reason: 'time_not_monotonic@1' })
    expect(run({ events: [link(B, 1_000), back(C, 2_000), link(E, 3_000)] })).toEqual({ ok: false, reason: 'back_target_mismatch@1' })
    expect(run({ events: [link(E, 1_000), link(B, 2_000)] })).toEqual({ ok: false, reason: 'move_after_finish@1' })
  })
})

describe('Run의 종류', () => {
  const daily = { kind: 'daily' as const, date: '2026-11-19', status: 'published', authorId: null }
  const me = '11111111-1111-4111-8111-111111111111'

  it('오늘의 문제를 그날 시작하면 기록에 든다', () => {
    expect(runKindFor(daily, '2026-11-19', me)).toEqual({ mode: 'daily', ranked: true })
  })

  it('지난 날의 문제는 지난 문제로 풀고 기록에 들지 않는다', () => {
    expect(runKindFor(daily, '2026-11-20', me)).toEqual({ mode: 'archive', ranked: false })
  })

  it('아직 오지 않은 날의 문제는 시작할 수 없다', () => {
    expect(runKindFor(daily, '2026-11-18', me)).toBeNull()
    expect(runKindFor({ ...daily, date: null }, '2026-11-19', me)).toBeNull()
  })

  it('공개되지 않은 문제는 시작할 수 없다', () => {
    expect(runKindFor({ ...daily, status: 'draft' }, '2026-11-19', me)).toBeNull()
    expect(runKindFor({ ...daily, status: 'hidden' }, '2026-11-19', me)).toBeNull()
  })

  it('커뮤니티 문제는 기록에 들고, 출제자 본인은 들지 않는다', () => {
    const community = { kind: 'community' as const, date: null, status: 'published', authorId: me }
    expect(runKindFor(community, '2026-11-19', '22222222-2222-4222-8222-222222222222')).toEqual({ mode: 'community', ranked: true })
    expect(runKindFor(community, '2026-11-19', me)).toEqual({ mode: 'community', ranked: false })
    expect(runKindFor({ ...community, kind: 'official', authorId: null }, '2026-11-19', me)).toEqual({ mode: 'community', ranked: true })
  })
})

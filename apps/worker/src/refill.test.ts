import { describe, expect, it } from 'vitest'
import { BATCH, canCallNow, dispatchRequest, RANDOM_BELOW, REFILL_BELOW, REFILL_COOLDOWN_MS, refillInputs, shouldRefill, type RefillState } from './refill.ts'

const NOW = Date.UTC(2026, 10, 21, 0, 5)
const called = (hoursAgo: number, ok = true): RefillState => ({ at: NOW - hoursAgo * 3600_000, ok, status: ok ? 204 : 401, left: 5 })

describe('문제 채우기를 부를 때', () => {
  const left = (queue: number, random = 40) => ({ queue, random })
  it('대기열과 랜덤 풀이 넉넉하면 부르지 않는다', () => {
    expect(shouldRefill(left(REFILL_BELOW), null, NOW)).toBe(false)
  })
  it('줄었고 부른 적이 없으면 부른다', () => {
    expect(shouldRefill(left(REFILL_BELOW - 1), null, NOW)).toBe(true)
    expect(shouldRefill(left(50, RANDOM_BELOW - 1), null, NOW)).toBe(true)
  })
  it('한 번 채우고 나면 랜덤 풀이 부족해 보이지 않는다(채우는 양이 기준보다 크다)', () => {
    expect(BATCH.random).toBeGreaterThan(RANDOM_BELOW)
    expect(shouldRefill(left(50, BATCH.random), null, NOW)).toBe(false)
  })
  it('부른 지 얼마 안 됐으면 도는 중이라 다시 부르지 않는다', () => {
    expect(shouldRefill(left(3), called(2), NOW)).toBe(false)
  })
  it('실패했어도 매시 다시 부르지 않고, 하루쯤 지나면 다시 부른다', () => {
    expect(shouldRefill(left(3), called(5, false), NOW)).toBe(false)
    expect(shouldRefill(left(3), called(REFILL_COOLDOWN_MS / 3600_000, false), NOW)).toBe(true)
  })
  it('모자란 쪽만 만들게 한다', () => {
    expect(refillInputs(left(50, 5))).toEqual({ daily: '0', official: '0', random: '40' })
    expect(refillInputs(left(5, 30))).toEqual({ daily: '40', official: '8', random: '0' })
    expect(refillInputs(left(50, 30), true)).toEqual({ daily: '40', official: '8', random: '40' })
  })
})

describe('GitHub에 보내는 요청', () => {
  it('저장소의 문제 채우기 작업을 main에서 돌려 달라고 한다', async () => {
    const r = dispatchRequest('t')
    expect(r.method).toBe('POST')
    expect(r.url).toBe('https://api.github.com/repos/naco0406/linkle/actions/workflows/puzzles.yml/dispatches')
    expect(r.headers.get('authorization')).toBe('Bearer t')
    expect(r.headers.get('user-agent')).toBeTruthy()
    expect(await r.json()).toEqual({ ref: 'main' })
    expect(await dispatchRequest('t', { daily: '0', official: '0', random: '40' }).json()).toEqual({ ref: 'main', inputs: { daily: '0', official: '0', random: '40' } })
  })
})

describe('지금 채우기', () => {
  it('방금 받아들여진 호출이 있으면 한 시간은 막는다', () => {
    expect(canCallNow(null, NOW)).toBe(true)
    expect(canCallNow(called(0.5), NOW)).toBe(false)
    expect(canCallNow(called(1), NOW)).toBe(true)
  })
  it('실패한 호출 뒤에는 바로 다시 누를 수 있다', () => {
    expect(canCallNow(called(0.1, false), NOW)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { canCallNow, dispatchRequest, REFILL_BELOW, REFILL_COOLDOWN_MS, shouldRefill, type RefillState } from './refill.ts'

const NOW = Date.UTC(2026, 10, 21, 0, 5)
const called = (hoursAgo: number, ok = true): RefillState => ({ at: NOW - hoursAgo * 3600_000, ok, status: ok ? 204 : 401, left: 5 })

describe('문제 채우기를 부를 때', () => {
  it('대기열이 넉넉하면 부르지 않는다', () => {
    expect(shouldRefill(REFILL_BELOW, null, NOW)).toBe(false)
  })
  it('줄었고 부른 적이 없으면 부른다', () => {
    expect(shouldRefill(REFILL_BELOW - 1, null, NOW)).toBe(true)
  })
  it('부른 지 얼마 안 됐으면 도는 중이라 다시 부르지 않는다', () => {
    expect(shouldRefill(3, called(2), NOW)).toBe(false)
  })
  it('실패했어도 매시 다시 부르지 않고, 하루쯤 지나면 다시 부른다', () => {
    expect(shouldRefill(3, called(5, false), NOW)).toBe(false)
    expect(shouldRefill(3, called(REFILL_COOLDOWN_MS / 3600_000, false), NOW)).toBe(true)
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

import { describe, expect, it } from 'vitest'
import { ATTEMPTS, backoffMs, STALL_MS } from './download.ts'

describe('덤프 받기', () => {
  it('멈추면 끊고, 몇 번 다시 받는다', () => {
    expect(ATTEMPTS).toBeGreaterThanOrEqual(3)
    expect(STALL_MS).toBeLessThanOrEqual(120_000)
  })
  it('기다리는 시간은 늘어나되 1분을 넘지 않는다', () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([5_000, 10_000, 20_000, 40_000, 60_000])
  })
})

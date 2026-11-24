import { describe, expect, it } from 'vitest'
import { DECOYS, reelAt, reelOf, SETTLE_MS, SPIN_UP_MS } from './reel'

describe('룰렛 릴', () => {
  it('처음에는 멈춰 있다가 빨라지고, 정한 시각에 정한 칸에서 멈춘다', () => {
    expect(reelAt(0, 3200, 30).p).toBe(0)
    expect(reelAt(SPIN_UP_MS, 3200, 30).v).toBeGreaterThan(reelAt(SPIN_UP_MS / 2, 3200, 30).v)
    expect(reelAt(3200, 3200, 30).p).toBeGreaterThan(30)
    expect(reelAt(3200, 3200, 30).p).toBeLessThan(30.2)
    expect(reelAt(3200 + SETTLE_MS, 3200, 30)).toMatchObject({ v: 0, done: true })
    expect(reelAt(3200 + SETTLE_MS, 3200, 30).p).toBeCloseTo(30, 5)
  })
  it('빨라지는 구간과 느려지는 구간이 끊기지 않는다', () => {
    const a = reelAt(SPIN_UP_MS - 0.01, 3200, 30)
    const b = reelAt(SPIN_UP_MS + 0.01, 3200, 30)
    expect(Math.abs(a.p - b.p)).toBeLessThan(0.01)
    expect(Math.abs(a.v - b.v)).toBeLessThan(0.5)
  })
  it('위치는 앞으로만 간다(멈추기 전까지)', () => {
    let prev = -1
    for (let t = 0; t <= 3200; t += 16) {
      const { p } = reelAt(t, 3200, 30)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
  it('마지막 1초에는 한 칸씩 넘어가는 것이 보일 만큼 느리다', () => {
    expect(reelAt(3200 - 500, 3200, 30).v).toBeLessThan(6)
    expect(reelAt(SPIN_UP_MS + 100, 3200, 30).v).toBeGreaterThan(20)
  })
  it('같은 seed면 같은 미끼, 정답은 미끼에 섞이지 않는다', () => {
    expect(reelOf(7, 20, ['피아노'])).toEqual(reelOf(7, 20, ['피아노']))
    expect(reelOf(7, 200, ['피아노'])).not.toContain('피아노')
    expect(DECOYS.length).toBeGreaterThan(80)
  })
})

import { describe, expect, it } from 'vitest'
import { averageMoves, emptyStats, moveDistribution, recordDaily, streakOn, weekOf, type Stats } from './index.ts'

const play = (stats: Stats, ...days: [string, number][]) => days.reduce((s, [date, moves]) => recordDaily(s, { date, moves }), stats)

describe('내 기록', () => {
  it('매일 풀면 연속 일수가 늘고, 하루 건너뛰면 1부터 다시 센다', () => {
    let s = play(emptyStats(), ['2026-11-16', 5], ['2026-11-17', 6], ['2026-11-18', 4])
    expect([s.played, s.streak, s.maxStreak]).toEqual([3, 3, 3])
    s = play(s, ['2026-11-20', 7])
    expect([s.played, s.streak, s.maxStreak]).toEqual([4, 1, 3])
  })

  it('같은 날짜를 두 번 넣거나 지난 날짜를 넣어도 바뀌지 않는다', () => {
    const s = play(emptyStats(), ['2026-11-18', 5])
    expect(play(s, ['2026-11-18', 9])).toBe(s)
    expect(play(s, ['2026-11-10', 9])).toBe(s)
  })

  it('달이 바뀌어도 이어진다', () => {
    const s = play(emptyStats(), ['2026-11-30', 5], ['2026-12-01', 5])
    expect(s.streak).toBe(2)
  })

  it('입력을 바꾸지 않는다', () => {
    const s = emptyStats()
    play(s, ['2026-11-18', 5])
    expect(s).toEqual(emptyStats())
  })
})

describe('연속 상태', () => {
  const s = play(emptyStats(), ['2026-11-17', 5], ['2026-11-18', 6])
  it('오늘 풀었으면 이어진 상태', () => {
    expect(streakOn(s, '2026-11-18')).toEqual({ count: 2, doneToday: true, atRisk: false })
  })
  it('어제까지 풀었으면 오늘 풀어야 이어진다', () => {
    expect(streakOn(s, '2026-11-19')).toEqual({ count: 2, doneToday: false, atRisk: true })
  })
  it('이틀 넘게 쉬었으면 0', () => {
    expect(streakOn(s, '2026-11-20')).toEqual({ count: 0, doneToday: false, atRisk: false })
  })
  it('기록이 없으면 0', () => {
    expect(streakOn(emptyStats(), '2026-11-19')).toEqual({ count: 0, doneToday: false, atRisk: false })
  })
})

describe('이번 주', () => {
  // 2026-11-19는 목요일
  const s = play(emptyStats(), ['2026-11-16', 5], ['2026-11-18', 6])
  it('월요일부터 일요일까지 일곱 칸', () => {
    const week = weekOf(s, '2026-11-19')
    expect(week.map(d => d.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    expect(week.map(d => d.state)).toEqual(['done', 'missed', 'done', 'today', 'future', 'future', 'future'])
  })
  it('오늘을 풀면 오늘 칸이 채워진다', () => {
    expect(weekOf(play(s, ['2026-11-19', 5]), '2026-11-19')[3]!.state).toBe('done')
  })
  it('일요일은 그 주의 마지막 칸이다', () => {
    const week = weekOf(emptyStats(), '2026-11-22')
    expect(week[0]!.date).toBe('2026-11-16')
    expect(week[6]).toMatchObject({ date: '2026-11-22', state: 'today' })
  })
})

describe('이동 횟수', () => {
  const s = play(emptyStats(), ['2026-11-10', 2], ['2026-11-11', 3], ['2026-11-12', 5], ['2026-11-13', 5], ['2026-11-14', 12])
  it('3번 이하와 9번 이상은 양 끝 칸에 모은다', () => {
    expect(moveDistribution(s).map(b => b.count)).toEqual([2, 0, 2, 0, 0, 0, 1])
  })
  it('평균', () => {
    expect(averageMoves(s)).toBeCloseTo(27 / 5)
    expect(averageMoves(emptyStats())).toBeNull()
  })
})

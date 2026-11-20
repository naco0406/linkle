import { describe, expect, it } from 'vitest'
import { addDays, addMonths, averageMoves, bestsOf, binMoves, monthGrid, emptyStats, moveDistribution, recordDaily, streakOn, weekOf, type Stats } from './index.ts'

const play = (stats: Stats, ...days: [string, number][]) => days.reduce((s, [date, moves]) => recordDaily(s, { date, moves, ms: moves * 10_000 }), stats)

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
  it('요일이 아니라 지금 이어지는 기록의 첫날부터 일곱 칸', () => {
    // 11-18에 풀고 11-19는 아직: 어제 하루가 앞에, 다음이 오늘
    const week = weekOf(s, '2026-11-19')
    expect(week.map(d => d.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'])
    expect(week.map(d => d.state)).toEqual(['done', 'today', 'future', 'future', 'future', 'future', 'future'])
    expect(week.map(d => d.weekday)).toEqual([2, 3, 4, 5, 6, 0, 1])
  })
  it('새로 시작하면 오늘이 맨 앞이다(금요일이면 금 토 일 월 화 수 목)', () => {
    const week = weekOf(play(emptyStats(), ['2026-11-20', 5]), '2026-11-20')
    expect(week[0]).toMatchObject({ date: '2026-11-20', state: 'done', weekday: 4 })
    expect(week.map(d => d.weekday)).toEqual([4, 5, 6, 0, 1, 2, 3])
  })
  it('오래 이어 가도 지난 날은 세 칸까지만 보이고, 오늘 뒤로 세 칸이 남는다', () => {
    const long = play(emptyStats(), ...Array.from({ length: 10 }, (_, i) => [addDays('2026-11-10', i), 5] as [string, number]))
    const week = weekOf(long, '2026-11-20')
    expect(week.map(d => d.state)).toEqual(['done', 'done', 'done', 'today', 'future', 'future', 'future'])
    expect(week[0]!.date).toBe('2026-11-17')
    expect(weekOf(play(long, ['2026-11-20', 4]), '2026-11-20')[3]).toMatchObject({ date: '2026-11-20', state: 'done' })
  })
  it('끊긴 뒤에는 오늘부터 다시', () => {
    expect(weekOf(s, '2026-11-25')[0]).toMatchObject({ date: '2026-11-25', state: 'today' })
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

describe('날짜별 결과', () => {
  it('푼 날의 이동 횟수와 시간을 남긴다', () => {
    const s = recordDaily(emptyStats(), { date: '2026-11-19', moves: 7, ms: 82_000 })
    expect(s.recent).toEqual({ '2026-11-19': { moves: 7, ms: 82_000 } })
  })
  it('오래된 날은 함께 버린다', () => {
    let s = emptyStats()
    for (let i = 0; i < 410; i++) s = recordDaily(s, { date: addDays('2026-01-01', i), moves: 5, ms: 1 })
    expect(Object.keys(s.recent)).toHaveLength(400)
    expect(s.recent['2026-01-01']).toBeUndefined()
    expect(s.recent[addDays('2026-01-01', 409)]).toBeDefined()
  })
})

describe('날짜 더하기', () => {
  it('달과 해를 넘긴다', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('이동 횟수 칸', () => {
  it('어떤 횟수 묶음이든 같은 일곱 칸으로 나눈다', () => {
    expect(binMoves({ 3: 1, 5: 4, 11: 2 }).map(b => b.count)).toEqual([1, 0, 4, 0, 0, 0, 2])
  })
})

describe('최고 기록', () => {
  it('가장 적은 이동과 가장 빠른 도착을 따로 고른다', () => {
    let s = emptyStats()
    s = recordDaily(s, { date: '2026-11-18', moves: 4, ms: 90_000 })
    s = recordDaily(s, { date: '2026-11-19', moves: 6, ms: 30_000 })
    s = recordDaily(s, { date: '2026-11-20', moves: 4, ms: 50_000 })
    expect(bestsOf(s)).toEqual({ fewest: { date: '2026-11-18', moves: 4 }, fastest: { date: '2026-11-19', ms: 30_000 } })
  })
  it('푼 날이 없으면 비어 있다', () => {
    expect(bestsOf(emptyStats())).toEqual({ fewest: null, fastest: null })
  })
})

describe('달력', () => {
  it('일요일부터 시작하고 1일 앞은 비운다', () => {
    const g = monthGrid('2026-11')
    // 2026-11-01은 일요일
    expect(g[0]).toBe('2026-11-01')
    expect(g).toHaveLength(30)
    const dec = monthGrid('2026-12')
    // 2026-12-01은 화요일
    expect(dec.slice(0, 3)).toEqual([null, null, '2026-12-01'])
    expect(dec.at(-1)).toBe('2026-12-31')
  })
  it('달을 넘긴다', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

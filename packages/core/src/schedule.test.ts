import { describe, expect, it } from 'vitest'
import { projectSchedule, type ScheduleRow } from './schedule.ts'

type Row = ScheduleRow & { id: number }
const row = (id: number, difficulty: Row['difficulty'], start_id = id * 10, end_id = id * 10 + 1, priority = 0): Row => ({ id, start_id, end_id, difficulty, priority })

describe('앞으로의 일정', () => {
  it('요일 난이도에 맞는 것부터 하루씩 낸다', () => {
    // 2026-12-05는 토요일(어려움), 12-07은 월요일(쉬움)
    const q = [row(1, 'easy'), row(2, 'normal'), row(3, 'hard'), row(4, 'hard'), row(5, 'easy')]
    const plan = projectSchedule(q, [], '2026-12-05')
    expect(plan.map(p => [p.date, p.row.id])).toEqual([
      ['2026-12-05', 3],
      ['2026-12-06', 4],
      ['2026-12-07', 1],
      ['2026-12-08', 5],
      ['2026-12-09', 2],
    ])
  })
  it('당긴 문제는 요일과 상관없이 먼저 낸다', () => {
    const q = [row(1, 'easy'), row(2, 'normal', 20, 21, 100)]
    expect(projectSchedule(q, [], '2026-12-05')[0]?.row.id).toBe(2)
  })
  it('최근 30일 안에 쓴 문서는 30일이 지나서 낸다', () => {
    // 출발 문서 7이 12-04에 나왔다
    const q = [row(1, 'normal', 7, 8)]
    const plan = projectSchedule(q, [{ date: '2026-12-04', start_id: 7, end_id: 99 }], '2026-12-05')
    expect(plan).toEqual([{ date: '2027-01-04', row: q[0] }])
  })
  it('일정 안에서 쓴 문서도 다음 날부터는 최근 문서로 친다', () => {
    const q = [row(1, 'hard', 1, 2), row(2, 'hard', 2, 3), row(3, 'hard', 4, 5)]
    const plan = projectSchedule(q, [], '2026-12-05')
    expect(plan.map(p => p.row.id)).toEqual([1, 3, 2])
    expect(plan[2]?.date).toBe('2027-01-05')
  })
})

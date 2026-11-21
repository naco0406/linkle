import { addDays, daysBetween, projectSchedule } from '@linkle/core'
import type { PlacedDay, QueueData, QueueItem } from '../../game/admin'
import { monthDay } from './kit'

// 일정 탭의 계산. 날짜가 붙은 앞날(정해짐)에 이어, 대기열을 Worker와 같은 규칙으로 날짜에 펼친다(예상).

export type PlanEntry = { key: string; date: string } & ({ kind: 'fixed'; day: PlacedDay } | { kind: 'expected'; item: QueueItem } | { kind: 'past'; day: PlacedDay })

function project(q: QueueData, queue: QueueItem[]) {
  const fixed = q.placed.filter(p => p.date > q.today).sort((a, b) => (a.date < b.date ? -1 : 1))
  const from = addDays(fixed.at(-1)?.date ?? q.today, 1)
  return { fixed, planned: projectSchedule(queue, q.placed, from) }
}

export function buildPlan(q: QueueData): PlanEntry[] {
  const { fixed, planned } = project(q, q.approved)
  return [
    ...fixed.map(day => ({ key: `d${day.id}`, date: day.date, kind: 'fixed' as const, day })),
    ...planned.map(p => ({ key: `q${p.row.id}`, date: p.date, kind: 'expected' as const, item: p.row })),
  ]
}

/** 지난 문제(오늘 포함). 최근 것이 위 */
export function pastDays(q: QueueData): PlanEntry[] {
  return q.placed
    .filter(p => p.date <= q.today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(day => ({ key: `p${day.id}`, date: day.date, kind: 'past' as const, day }))
}

/** 이 문제를 빼면 그날 무엇이 나가는지 */
export function replacementFor(q: QueueData, item: QueueItem, date: string): QueueItem | null {
  const { planned } = project(
    q,
    q.approved.filter(a => a.id !== item.id),
  )
  return planned.find(p => p.date === date)?.row ?? null
}

/** 월요일에 시작하는 주. "이번 주", "다음 주", "지난주", 그 밖은 "12월 14일 주" */
export function weekLabel(date: string, today: string): string {
  const monday = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Math.round(daysBetween(monday(today), monday(date)) / 7)
  return weeks === 0 ? '이번 주' : weeks === 1 ? '다음 주' : weeks === -1 ? '지난주' : `${monthDay(monday(date))} 주`
}

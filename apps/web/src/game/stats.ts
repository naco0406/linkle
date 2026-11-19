import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyStats, moveCount, recordDaily, type Run, type Stats } from '@linkle/core'

/** 내 기록을 저장하는 키. 이 기기에만 남는다 */
export const STATS_KEY = 'linkle:stats:v1'

type StatsState = {
  stats: Stats
  /** 방금 연속 일수가 늘어난 날짜. 축하 화면을 한 번만 보여 주려고 둔다 */
  celebrate: string | null
  /** 끝난 판을 기록한다. 오늘의 문제만 센다. 같은 날을 두 번 넣어도 한 번만 들어간다 */
  record(run: Run): void
  celebrated(): void
}

export const useStats = create<StatsState>()(
  persist(
    (set, get) => ({
      stats: emptyStats(),
      celebrate: null,
      record: run => {
        if (run.mode !== 'daily' || run.phase !== 'finished' || !run.puzzle.date) return
        const before = get().stats
        const after = recordDaily(before, { date: run.puzzle.date, moves: moveCount(run) })
        if (after !== before) set({ stats: after, celebrate: run.puzzle.date })
      },
      celebrated: () => set({ celebrate: null }),
    }),
    {
      name: STATS_KEY,
      version: 1,
      migrate: () => ({ stats: emptyStats(), celebrate: null }),
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<StatsState>
        const ok = s.stats && s.stats.v === 1 && Array.isArray(s.stats.days)
        return { ...current, stats: ok ? s.stats! : emptyStats(), celebrate: typeof s.celebrate === 'string' ? s.celebrate : null }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STATS_KEY) void useStats.persist.rehydrate()
  })
}

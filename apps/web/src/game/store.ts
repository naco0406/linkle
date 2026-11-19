import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addFlag, applyBack, applyLink, kstDate, RUN_VERSION, type Page, type Run } from '@linkle/core'
import type { Today } from './api'

/** 오늘의 Run을 저장하는 키. 형식이 바뀌면 버전을 올리고 이전 저장분은 버린다 */
export const RUN_KEY = 'linkle:run:v1'

type GameState = {
  run: Run | null
  /** 서버 시각 - 기기 시각 */
  clockOffset: number
  /** 서버가 알려 준 오늘. 저장하지 않고 앱을 열 때마다 다시 받는다 */
  today: Today | null
  begin(run: Run, serverNow: number): void
  /** 서버의 오늘을 반영한다. 날짜가 넘어갔으면 끝난 지난 판을 치운다 */
  setToday(today: Today): void
  /** 완료 제출을 마무리한다. result가 null이면 서버가 받지 않은 판이다(더 보내지 않는다) */
  settle(runId: string, result: Run['result']): void
  link(move: { to: Page; via: string; lead: string }): void
  back(): void
  flag(name: string): void
  setEmoji(runId: string, emoji: string[]): void
}

/** 저장된 Run을 그대로 쓸 수 있는지 본다. 지난 날짜의 끝난 판은 버린다 */
function keep(run: unknown): Run | null {
  if (!run || typeof run !== 'object') return null
  const r = run as Run
  if (r.v !== RUN_VERSION || !r.puzzle || !Array.isArray(r.events)) return null
  if (r.mode === 'daily' && r.phase === 'finished' && r.puzzle.date !== kstDate(Date.now())) return null
  return r
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      run: null,
      clockOffset: 0,
      today: null,
      begin: (run, serverNow) => set({ run, clockOffset: serverNow - Date.now() }),
      setToday: today => {
        const { run } = get()
        // 진행 중인 판은 자정을 넘겨도 끝까지 풀 수 있게 둔다. 치우는 것은 끝난 판뿐이다
        const stale = run?.mode === 'daily' && run.phase === 'finished' && run.puzzle.date !== today.date
        set({ today, clockOffset: today.serverNow - Date.now(), ...(stale ? { run: null } : null) })
      },
      settle: (runId, result) => {
        const { run } = get()
        if (run && run.runId === runId && run.phase === 'finished') set({ run: { ...run, result, outbox: 'none' } })
      },
      link: move => {
        const { run } = get()
        if (run) set({ run: applyLink(run, { ...move, at: now() - run.startedAt }) })
      },
      back: () => {
        const { run } = get()
        if (run) set({ run: applyBack(run, now() - run.startedAt) })
      },
      flag: name => {
        const { run } = get()
        if (run && run.phase === 'playing') set({ run: addFlag(run, name) })
      },
      setEmoji: (runId, emoji) => {
        const { run } = get()
        if (run && run.runId === runId) set({ run: { ...run, emoji } })
      },
    }),
    {
      name: RUN_KEY,
      version: RUN_VERSION,
      partialize: s => ({ run: s.run, clockOffset: s.clockOffset }),
      migrate: () => ({ run: null, clockOffset: 0 }),
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<GameState>
        return { ...current, run: keep(s.run), clockOffset: typeof s.clockOffset === 'number' ? s.clockOffset : 0 }
      },
    },
  ),
)

/** 서버 시각으로 보정한 현재 시각 */
export function now(): number {
  return Date.now() + useGame.getState().clockOffset
}

// 다른 탭이 저장소를 바꾸면 다시 읽는다. 두 탭에서 진행해도 로그는 하나다
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === RUN_KEY) void useGame.persist.rehydrate()
  })
}

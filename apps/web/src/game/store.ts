import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addFlag, applyBack, applyLink, kstDate, RUN_VERSION, type Page, type Run } from '@linkle/core'
import type { Today } from './api'
import { useStats } from './stats'

/** 판을 저장하는 키. 형식이 바뀌면 버전을 올리고 이전 저장분은 버린다 */
export const RUN_KEY = 'linkle:run:v1'

/**
 * 판이 놓이는 자리. 오늘의 문제는 'daily' 하나, 지난 문제와 커뮤니티 문제는 문제 id마다 하나다.
 * 오늘의 문제를 풀다가 지난 문제를 열어도 서로의 진행이 섞이지 않는다.
 */
export type Slot = 'daily' | number

/** 지난 문제·커뮤니티 판을 몇 개까지 기기에 둘지. 넘으면 오래된 끝난 판부터 지운다 */
const KEEP_OTHERS = 80

type Move = { to: Page; via: string; lead: string }

type GameState = {
  /** 오늘의 문제 */
  run: Run | null
  /** 지난 문제·커뮤니티 문제. 키는 문제 id */
  others: Record<string, Run>
  /** 서버 시각 - 기기 시각 */
  clockOffset: number
  /** 서버가 알려 준 오늘. 저장하지 않고 앱을 열 때마다 다시 받는다 */
  today: Today | null
  /** 오늘의 문제가 아직 없다고 서버가 답했다(출제 대기열이 비었을 때) */
  noPuzzle: boolean
  /** 날짜가 넘어가 자동으로 끝낸 판의 문제. 홈에서 한 번 알린다. 저장하지 않는다 */
  ended: Run['puzzle'] | null
  /** 도착 화면을 닫은 판. 닫은 뒤에는 홈(또는 문제 화면)이 보인다 */
  seen: string[]
  begin(slot: Slot, run: Run, serverNow: number): void
  /** 서버의 오늘을 반영한다. 날짜가 넘어갔으면 지난 판을 끝낸다(푸는 중이어도) */
  setToday(today: Today): void
  /** 서버가 오늘 문제가 없다고 답했다. 그래도 어제 판은 끝낸다 */
  setNoPuzzle(): void
  /** 완료 제출을 마무리한다. result가 null이면 서버가 받지 않은 판이다(더 보내지 않는다) */
  settle(runId: string, result: Run['result']): void
  link(slot: Slot, move: Move): void
  back(slot: Slot): void
  flag(slot: Slot, name: string): void
  setEmoji(runId: string, emoji: string[]): void
  showArrival(runId: string, show: boolean): void
  /** 자리의 판을 치운다(관리자 연습 판) */
  drop(slot: Slot): void
}

export const runIn = (s: Pick<GameState, 'run' | 'others'>, slot: Slot): Run | null => (slot === 'daily' ? s.run : (s.others[String(slot)] ?? null))

/** 모든 자리의 판 */
export const allRuns = (s: Pick<GameState, 'run' | 'others'>): Run[] => [...(s.run ? [s.run] : []), ...Object.values(s.others)]

/** 그 날짜에는 이미 지나간 오늘의 문제 판인지. 자정 전에 보낸 요청의 답이 늦게 와도 새 날의 판이 걸리지 않게 앞선 날짜만 본다 */
const isPast = (run: Run, date: string) => run.mode === 'daily' && !!run.puzzle.date && run.puzzle.date < date

/** 날짜가 date로 넘어갔을 때 바꿀 값. 하루 한 문제라 푸는 중이어도 끝낸다. 남겨 두면 홈이 게임 화면뿐이라 갇힌다 */
function rollOver(run: Run | null, date: string): Partial<GameState> {
  if (!run || !isPast(run, date)) return {}
  return { run: null, ...(run.phase === 'playing' ? { ended: run.puzzle } : null) }
}

/** 저장된 Run을 그대로 쓸 수 있는지 본다. 지난 날짜의 끝난 오늘의 문제는 버린다 */
function keep(run: unknown): Run | null {
  if (!run || typeof run !== 'object') return null
  const r = run as Run
  if (r.v !== RUN_VERSION || !r.puzzle || !Array.isArray(r.events)) return null
  if (r.mode === 'daily' && r.phase === 'finished' && r.puzzle.date !== kstDate(Date.now())) return null
  return r
}

function prune(others: Record<string, Run>): Record<string, Run> {
  const entries = Object.entries(others)
  if (entries.length <= KEEP_OTHERS) return others
  // 진행 중인 판은 남기고, 끝난 판은 최근 것부터 남긴다
  const sorted = entries.sort(([, a], [, b]) => (a.phase === 'playing' ? -1 : b.phase === 'playing' ? 1 : b.startedAt - a.startedAt))
  return Object.fromEntries(sorted.slice(0, KEEP_OTHERS))
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** 자리의 판을 바꾼다. 그 판이 없으면 아무것도 하지 않는다 */
      const update = (slot: Slot, f: (run: Run) => Run) => {
        const run = runIn(get(), slot)
        if (!run) return
        const next = f(run)
        if (next === run) return
        if (slot === 'daily') set({ run: next })
        else set({ others: { ...get().others, [String(slot)]: next } })
      }
      /** runId로 판을 찾아 바꾼다(제출 결과·이모지는 어느 자리의 판인지 모른 채 온다) */
      const updateById = (runId: string, f: (run: Run) => Run) => {
        const { run, others } = get()
        if (run?.runId === runId) return update('daily', f)
        const key = Object.keys(others).find(k => others[k]!.runId === runId)
        if (key) update(Number(key), f)
      }
      return {
        run: null,
        others: {},
        clockOffset: 0,
        today: null,
        noPuzzle: false,
        ended: null,
        seen: [],
        showArrival: (runId, show) => {
          const seen = get().seen.filter(id => id !== runId)
          set({ seen: show ? seen : [...seen, runId].slice(-100) })
        },
        begin: (slot, run, serverNow) => {
          const clockOffset = serverNow - Date.now()
          if (slot === 'daily') set({ run, clockOffset, ended: null })
          else set({ others: prune({ ...get().others, [String(slot)]: run }), clockOffset })
        },
        setToday: today => {
          set({ today, noPuzzle: false, clockOffset: today.serverNow - Date.now(), ...rollOver(get().run, today.date) })
        },
        setNoPuzzle: () => set({ noPuzzle: true, ...rollOver(get().run, kstDate(now())) }),
        settle: (runId, result) => updateById(runId, r => (r.phase === 'finished' ? { ...r, result, outbox: 'none' } : r)),
        link: (slot, move) => {
          const before = runIn(get(), slot)
          update(slot, r => applyLink(r, { ...move, at: now() - r.startedAt }))
          const after = runIn(get(), slot)
          // 오늘의 문제에 방금 도착했으면 내 기록에 남긴다(지난 문제·커뮤니티는 넣지 않는다)
          if (before?.phase === 'playing' && after?.phase === 'finished') useStats.getState().record(after)
        },
        back: slot => update(slot, r => applyBack(r, now() - r.startedAt)),
        flag: (slot, name) => update(slot, r => (r.phase === 'playing' ? addFlag(r, name) : r)),
        setEmoji: (runId, emoji) => updateById(runId, r => ({ ...r, emoji })),
        drop: slot => {
          if (slot === 'daily') return set({ run: null })
          const others = { ...get().others }
          delete others[String(slot)]
          set({ others })
        },
      }
    },
    {
      name: RUN_KEY,
      version: RUN_VERSION,
      partialize: s => ({ run: s.run, others: s.others, clockOffset: s.clockOffset, seen: s.seen }),
      migrate: () => ({ run: null, others: {}, clockOffset: 0, seen: [] }),
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<GameState> & { arrivalSeen?: unknown }
        const others: Record<string, Run> = {}
        for (const [k, v] of Object.entries(s.others ?? {})) {
          const r = keep(v)
          if (r) others[k] = r
        }
        // 예전에는 닫은 도착 화면을 하나만 기억했다(arrivalSeen)
        const seen = Array.isArray(s.seen) ? s.seen.filter((x): x is string => typeof x === 'string') : typeof s.arrivalSeen === 'string' ? [s.arrivalSeen] : []
        // 다른 탭이 어제 판을 다시 저장했을 수 있다. 오늘을 이미 안다면 들이지 않는다
        const run = keep(s.run)
        const past = run && current.today && isPast(run, current.today.date)
        return { ...current, run: past ? null : run, others, seen, clockOffset: typeof s.clockOffset === 'number' ? s.clockOffset : 0 }
      },
    },
  ),
)

/** 서버 시각으로 보정한 현재 시각 */
export function now(): number {
  return Date.now() + useGame.getState().clockOffset
}

/**
 * 화면이 오늘의 문제로 보여 줄 판. 서버의 오늘을 아직 모르거나 닿지 못해도 어제 게임 화면에 가두지 않는다.
 * 그때는 기기 시각으로 가리기만 하고 지우는 일은 setToday가 한다(기기 시계가 틀렸으면 서버 답을 받고 다시 보인다).
 */
export function dailyRun(s: Pick<GameState, 'run' | 'today'>): Run | null {
  const { run, today } = s
  return run?.phase === 'playing' && isPast(run, today?.date ?? kstDate(now())) ? null : run
}

// 다른 탭이 저장소를 바꾸면 다시 읽는다. 두 탭에서 진행해도 로그는 하나다
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === RUN_KEY) void useGame.persist.rehydrate()
  })
}

/** 화면 위쪽 탭을 치워야 하는지. 게임 중이거나 막 도착한 화면이면 문서와 결과에 집중하게 한다 */
export const useImmersive = create<{ on: boolean; set(on: boolean): void }>(set => ({ on: false, set: on => set({ on }) }))

import { addDays, kstDate, nextKstMidnight } from '@linkle/core'
import { initialStats, isDone, nextToCheck, recordOf, winners, CANDIDATES, type StoredStats } from './daily.ts'
import { aggregateDaily, findDaily, insertStats, loadRunsForVerify, loadStats, markVerified, updateStats, type RunForVerify } from './db.ts'
import { verifyPath, WikiUnavailable, type WikiApi } from './verify.ts'

/**
 * 자정이 지나고 이만큼은 기다렸다가 모은다.
 * 자정 직전에 시작한 사람이 끝내고 제출할 시간이다. 그 뒤에 제출된 기록은 어제의 기록에 들어가지 않는다.
 */
export const SETTLE_MS = 5 * 60 * 1000

/** 지금 기준 "어제"(한국 날짜) */
export function yesterdayOf(now: number): string {
  return addDays(kstDate(now), -1)
}

/** 어제 것을 모아도 되는 시각인지 */
export function canAggregate(now: number): boolean {
  const midnight = nextKstMidnight(now) - 24 * 60 * 60 * 1000
  return now - midnight >= SETTLE_MS
}

/**
 * 어제의 기록을 읽는다. 아직 모으지 않았고 모아도 되는 시각이면 지금 모은다.
 * 예약 작업이 늦거나 빠져도 첫 방문자가 모으게 되어, 화면이 "모으는 중"에 머물지 않는다.
 * 두 요청이 동시에 모아도 먼저 넣은 쪽만 남는다.
 */
export async function ensureStats(db: D1Database, date: string, now: number): Promise<StoredStats | 'none' | 'pending'> {
  const stored = await loadStats(db, date)
  if (stored) return stored
  const daily = await findDaily(db, date)
  if (!daily) return 'none'
  if (!canAggregate(now)) return 'pending'
  const agg = await aggregateDaily(db, daily.puzzle, CANDIDATES)
  await insertStats(db, date, initialStats(daily.puzzle, agg))
  return (await loadStats(db, date)) ?? 'pending'
}

/** 예약 작업 한 번에 확인하는 후보 수의 상한. 위키백과 요청은 후보 하나에 두 번이다 */
const MAX_CHECKS = 6

/**
 * 예약 작업이 하는 일: 어제 것을 모으고, 기록 후보의 경로를 위키백과에서 확인한다.
 * 한 번에 다 끝내지 못하면(요청 제한, 후보가 많음) 다음 예약 때 이어서 한다.
 */
export async function dailyJob(db: D1Database, api: WikiApi, now: number): Promise<string> {
  const date = yesterdayOf(now)
  const ensured = await ensureStats(db, date, now)
  if (typeof ensured === 'string') return `${date}: ${ensured}`
  const stats = ensured
  if (stats.done) return `${date}: done`

  const loaded = new Map<string, RunForVerify>()
  const passed: string[] = []
  let checks = 0
  let stopped = ''
  while (checks < MAX_CHECKS && !stopped) {
    const ids = nextToCheck(stats)
    if (ids.length === 0) break
    for (const [id, run] of await loadRunsForVerify(db, ids)) loaded.set(id, run)
    for (const id of ids) {
      const run = loaded.get(id)
      if (!run) {
        stats.checked[id] = 'missing'
        continue
      }
      try {
        const verdict = await verifyPath(stats.start, run.events, api)
        stats.checked[id] = verdict.ok ? 'ok' : verdict.reason
        if (verdict.ok) passed.push(id)
      } catch (e) {
        if (!(e instanceof WikiUnavailable)) throw e
        stopped = `wiki ${e.message}`
        break
      }
      checks++
    }
  }

  // 정해진 기록을 싣는다. 앞서 확인해 두었던 판이 이번에 기록이 될 수도 있어 필요하면 읽어 온다
  const win = winners(stats)
  const need = (['shortest', 'fastest'] as const).filter(k => !stats[k] && win[k] && !loaded.has(win[k]!)).map(k => win[k]!)
  for (const [id, run] of await loadRunsForVerify(db, need)) loaded.set(id, run)
  for (const kind of ['shortest', 'fastest'] as const) {
    const id = win[kind]
    const run = id ? loaded.get(id) : undefined
    if (!stats[kind] && run) stats[kind] = recordOf(stats.start, run)
  }
  stats.done = isDone(stats)

  await markVerified(db, passed)
  await updateStats(db, date, stats)
  return `${date}: checked ${checks}${stopped ? `, stopped (${stopped})` : ''}${stats.done ? ', done' : ''}`
}

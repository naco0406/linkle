import { useEffect, useMemo, useState } from 'react'
import { ArrowUpToLine, Check, PinOff, RefreshCw, RotateCcw, Trash2, X, Pin } from 'lucide-react'
import { adminApi, type QueueAction, type QueueData, type QueueItem, type RejectedItem } from '../../game/admin'
import { DifficultyChip } from '../../ui/list'
import { Spinner } from '../../ui/parts'
import { ConfirmButton, DateBadge, hopsOf, kstDay, longDate, messageOf, monthDay, Pair, Pills, RowButton, SolutionPath, subject, useWide, weekdayOf, type Notify } from './kit'
import { buildPlan, replacementFor, weekLabel, type PlanEntry } from './plan'
import { WikiSummary } from './WikiSummary'

// 일정 탭. 남은 문제를 "몇 번째"가 아니라 "어느 날"로 보인다.
// 하나를 고르면 넓은 화면은 옆 패널, 좁은 화면은 아래 시트에서 두 문서 설명과 정답 경로를 보며 훑어본다.
// 단축키: J/K 다음·이전, Y 괜찮아요, X 빼기, Esc 닫기

export type PlanFilter = 'all' | 'unreviewed' | 'rejected'

type Props = { data: QueueData; filter: PlanFilter; onFilter: (f: PlanFilter) => void; notify: Notify; reload: () => void }

export function PlanTab({ data, filter, onFilter, notify, reload }: Props) {
  const wide = useWide()
  const plan = useMemo(() => buildPlan(data), [data])
  const unreviewed = plan.filter(e => e.kind === 'expected' && e.item.reviewed_at === null)
  const list = filter === 'unreviewed' ? unreviewed : plan
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = list.find(e => e.key === selected) ?? null

  // 넓은 화면에서 안 본 문제를 훑을 때는 첫 문제를 바로 연다
  useEffect(() => {
    if (wide && filter === 'unreviewed' && !current && unreviewed[0]) setSelected(unreviewed[0].key)
  }, [wide, filter, current, unreviewed])

  const act = async (item: QueueItem, action: QueueAction, done: string) => {
    if (busy) return
    // 처리한 뒤 갈 곳: 안 본 문제 중 다음 것(없으면 닫는다)
    const idx = list.findIndex(e => e.key === `q${item.id}`)
    const next = [...list.slice(idx + 1), ...list.slice(0, idx)].find(e => e.kind === 'expected' && e.item.reviewed_at === null && e.item.id !== item.id)
    setBusy(true)
    try {
      await adminApi.queueAction(item.id, action)
      notify(done)
      if (action === 'ok' || action === 'reject') setSelected(next?.key ?? null)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || filter === 'rejected') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const key = e.key.toLowerCase()
      const idx = list.findIndex(x => x.key === selected)
      if (key === 'j' || key === 'k') {
        const n = list[Math.min(list.length - 1, Math.max(0, idx < 0 ? 0 : idx + (key === 'j' ? 1 : -1)))]
        if (n) setSelected(n.key)
        e.preventDefault()
      } else if (key === 'escape') setSelected(null)
      else if (current?.kind === 'expected' && key === 'y' && current.item.reviewed_at === null) void act(current.item, 'ok', '봤다고 남겼어요')
      else if (current?.kind === 'expected' && key === 'x') void act(current.item, 'reject', '대기열에서 뺐어요')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const filters: [PlanFilter, string, number][] = [
    ['all', '전체', plan.length],
    ['unreviewed', '안 본 문제', unreviewed.length],
    ['rejected', '뺀 문제', data.rejected.length],
  ]
  const panel = current && <ReviewPanel entry={current} data={data} busy={busy} act={act} notify={notify} reload={reload} onClose={() => setSelected(null)} />

  return (
    <div className={wide && current ? 'grid grid-cols-[minmax(0,1fr)_420px] items-start gap-4' : ''}>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Pills label="일정 거르기" value={filter} options={filters} onChange={f => (onFilter(f), setSelected(null))} />
          <span className="text-[13px] leading-5 text-ink-2 max-sm:hidden">월화 쉬움, 수목금 보통, 주말 어려움</span>
        </div>
        {filter === 'rejected' ? (
          <Rejected items={data.rejected} busy={busy} notify={notify} reload={reload} />
        ) : (
          <PlanList list={list} today={data.today} selected={selected} onSelect={k => setSelected(k === selected ? null : k)} filter={filter} />
        )}
      </div>
      {wide ? (
        panel && <div className="sticky top-[136px]">{panel}</div>
      ) : (
        current && (
          <>
            <button className="fixed inset-0 z-30 bg-[rgb(30_40_60/0.2)]" aria-label="닫기" onClick={() => setSelected(null)} />
            <div className="fixed inset-x-0 bottom-0 z-40 max-h-[86dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2.5 shadow-[0_-12px_40px_-12px_rgb(30_50_90/0.3)]">
              <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-[#e6ecf6]" aria-hidden />
              {panel}
            </div>
          </>
        )
      )}
    </div>
  )
}

function PlanList({ list, today, selected, onSelect, filter }: { list: PlanEntry[]; today: string; selected: string | null; onSelect: (k: string) => void; filter: PlanFilter }) {
  if (!list.length)
    return (
      <div className="rounded-[20px] bg-white px-5 py-8 text-center text-[15px] text-ink-2">{filter === 'unreviewed' ? '안 본 문제가 없어요. 다 훑어봤어요.' : '낼 문제가 없어요'}</div>
    )
  let lastWeek = ''
  return (
    <div className="rounded-[20px] bg-white px-3 py-1 sm:px-4">
      {list.map(e => {
        const week = weekLabel(e.date, today)
        const head = week !== lastWeek
        lastWeek = week
        const s = e.kind === 'fixed' ? { start: e.day.start_title, end: e.day.end_title, difficulty: e.day.difficulty } : { start: e.item.start_title, end: e.item.end_title, difficulty: e.item.difficulty }
        const fresh = e.kind === 'expected' && e.item.reviewed_at === null
        return (
          <div key={e.key}>
            {head && <div className="px-2 pb-1.5 pt-3.5 text-[13px] font-semibold leading-5 text-ink-2">{week}</div>}
            <button
              onClick={() => onSelect(e.key)}
              aria-pressed={e.key === selected}
              className={`press grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-2 py-2 text-left sm:gap-3.5 ${e.key === selected ? 'bg-secondary' : ''}`}
            >
              <DateBadge date={e.date} sub={weekdayOf(e.date)} small />
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <Pair start={s.start} end={s.end} />
                  <DifficultyChip value={s.difficulty} />
                </span>
                <span className="mt-0.5 flex items-center gap-2.5 text-[14px] leading-5 text-ink-2 max-sm:hidden">
                  {e.kind === 'fixed' ? `정해짐 #${e.day.number}` : '예상'}
                  {e.kind === 'expected' && e.item.priority > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Pin className="h-3.5 w-3.5" aria-hidden />
                      당김
                    </span>
                  )}
                </span>
              </span>
              <span className={`h-2 w-2 rounded-full ${fresh ? 'bg-primary' : ''}`} aria-label={fresh ? '안 본 문제' : undefined} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** 고른 문제 하나. 두 문서 설명, 정답 경로, 빼면 무엇이 바뀌는지, 단추 */
function ReviewPanel({
  entry,
  data,
  busy,
  act,
  notify,
  reload,
  onClose,
}: {
  entry: PlanEntry
  data: QueueData
  busy: boolean
  act: (item: QueueItem, a: QueueAction, done: string) => Promise<void>
  notify: Notify
  reload: () => void
  onClose: () => void
}) {
  const [replacing, setReplacing] = useState(false)
  const p =
    entry.kind === 'fixed'
      ? { start: entry.day.start_title, end: entry.day.end_title, difficulty: entry.day.difficulty, solution: entry.day.solution }
      : { start: entry.item.start_title, end: entry.item.end_title, difficulty: entry.item.difficulty, solution: entry.item.solution }
  const hops = hopsOf(p.solution)
  const instead = entry.kind === 'expected' ? replacementFor(data, entry.item, entry.date) : null

  const replace = async () => {
    if (entry.kind !== 'fixed') return
    setReplacing(true)
    try {
      await adminApi.puzzleAction(entry.day.id, 'replace')
      notify(`${monthDay(entry.date)} 문제를 대기열의 다음 문제로 바꿨어요`)
      onClose()
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setReplacing(false)
    }
  }

  return (
    <section className="rounded-[20px] bg-white sm:p-5 lg:p-5" aria-label="고른 문제">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold leading-5 text-ink-2">
          {longDate(entry.date)} {entry.kind === 'fixed' ? `정해짐 #${entry.day.number}` : '예상'}
        </span>
        <button onClick={onClose} aria-label="닫기" className="press -mr-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-2">
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div className="mt-0.5">
        <Pair start={p.start} end={p.end} size="lg" />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
        <DifficultyChip value={p.difficulty} />
        <span>정답 {hops.length || '?'}번</span>
        {entry.kind === 'expected' && <span>{monthDay(kstDay(entry.item.created_at))}에 들어옴</span>}
        {entry.kind === 'expected' && entry.item.reviewed_at !== null && <span>{monthDay(kstDay(entry.item.reviewed_at))}에 봤어요</span>}
      </div>
      <div className="mt-4 grid gap-2">
        <WikiSummary role="출발" title={p.start} />
        <WikiSummary role="도착" title={p.end} />
      </div>
      <div className="mt-3">
        <SolutionPath start={p.start} hops={hops} count={false} />
      </div>

      {entry.kind === 'fixed' ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[14px] text-ink-2">{entry.day.plays > 0 ? '누가 이미 시작했어요' : '날짜가 붙은 문제예요'}</span>
          <ConfirmButton confirm="정말 바꿀까요?" disabled={replacing || entry.day.plays > 0} onConfirm={() => void replace()}>
            {replacing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            다른 문제로
          </ConfirmButton>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[14px] leading-5 text-ink-2">
            {instead ? `빼면 ${monthDay(entry.date)}에는 ${instead.start_title} → ${subject(instead.end_title)} 나가요` : `빼면 ${monthDay(entry.date)}에 낼 문제가 없어요`}
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            {entry.item.reviewed_at === null ? (
              <RowButton tone="solid" className="!h-11 text-[15px]" disabled={busy} onClick={() => void act(entry.item, 'ok', '봤다고 남겼어요')}>
                <Check className="h-4 w-4" aria-hidden />
                괜찮아요
              </RowButton>
            ) : (
              <RowButton className="!h-11 text-[15px]" disabled={busy} onClick={() => void act(entry.item, 'unreview', '안 본 문제로 돌렸어요')}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                안 본 것으로
              </RowButton>
            )}
            <RowButton tone="danger" className="!h-11 text-[15px]" disabled={busy} onClick={() => void act(entry.item, 'reject', '대기열에서 뺐어요')}>
              <Trash2 className="h-4 w-4" aria-hidden />
              빼기
            </RowButton>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink-2 max-lg:hidden">
              <span className="flex items-center gap-1.5">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>다음, 이전
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Y</Kbd>괜찮아요
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>X</Kbd>빼기
              </span>
            </div>
            {entry.item.priority > 0 ? (
              <button disabled={busy} onClick={() => void act(entry.item, 'unpin', '당긴 것을 풀었어요')} className="press ml-auto inline-flex h-9 items-center gap-1 text-[14px] font-semibold text-primary">
                <PinOff className="h-4 w-4" aria-hidden />
                당김 풀기
              </button>
            ) : (
              <button disabled={busy} onClick={() => void act(entry.item, 'first', '맨 앞으로 당겼어요')} className="press ml-auto inline-flex h-9 items-center gap-1 text-[14px] font-semibold text-primary">
                <ArrowUpToLine className="h-4 w-4" aria-hidden />
                맨 앞으로
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-md border border-line bg-white px-1 font-sans text-[12px] font-semibold leading-none text-ink-2">{children}</kbd>
}

function Rejected({ items, busy, notify, reload }: { items: RejectedItem[]; busy: boolean; notify: Notify; reload: () => void }) {
  const [working, setWorking] = useState<number | null>(null)
  if (!items.length) return <div className="rounded-[20px] bg-white px-5 py-8 text-center text-[15px] text-ink-2">뺀 문제가 없어요</div>
  const restore = async (id: number) => {
    setWorking(id)
    try {
      await adminApi.queueAction(id, 'restore')
      notify('대기열 끝에 되돌렸어요')
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setWorking(null)
    }
  }
  return (
    <ul className="rounded-[20px] bg-white px-4 py-1 sm:px-6">
      {items.map(q => (
        <li key={q.id} className="flex items-center gap-3 border-t border-[#eef1f5] py-3 first:border-t-0">
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <Pair start={q.start_title} end={q.end_title} />
              <DifficultyChip value={q.difficulty} />
            </span>
            <span className="mt-0.5 block truncate text-[14px] leading-5 text-ink-2">{q.note ?? '이유 없음'}</span>
          </span>
          <RowButton disabled={busy || working !== null} onClick={() => void restore(q.id)}>
            {working === q.id ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            되돌리기
          </RowButton>
        </li>
      ))}
    </ul>
  )
}

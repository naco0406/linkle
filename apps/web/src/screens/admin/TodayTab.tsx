import { useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { addDays } from '@linkle/core'
import { adminApi, type AdminDay, type Difficulty, type Overview, type QueueData } from '../../game/admin'
import { Card } from '../../ui/cards'
import { DifficultyChip } from '../../ui/list'
import { Spinner } from '../../ui/parts'
import { ConfirmButton, DIFF, diffLabel, hopsOf, kstTime, longDate, messageOf, monthDay, Pair, PathLine, RowButton, SolutionPath, type Notify } from './kit'
import { buildPlan } from './plan'

// 오늘 탭(첫 화면). 맨 위 할 일 줄, 오늘과 내일, 최근 14일 도착률, 남은 문제.
// 운영자가 여는 이유 셋(볼 것이 있나, 내일은 괜찮나, 난이도가 맞았나)에 위에서부터 답한다.

const LOW_QUEUE = 7
const DAY_MS = 24 * 3600_000

const rateOf = (d: AdminDay) => (d.plays > 0 ? d.clears / d.plays : null)
const pct = (r: number) => Math.round(r * 100)

/** 지난 날(오늘 제외)의 난이도별 도착률. 도전한 사람 수로 가중한다 */
function averages(days: AdminDay[], today: string): Partial<Record<Difficulty, number>> {
  const out: Partial<Record<Difficulty, number>> = {}
  for (const [d] of DIFF) {
    const past = days.filter(x => x.date < today && x.difficulty === d && x.plays > 0)
    const plays = past.reduce((n, x) => n + x.plays, 0)
    if (plays > 0) out[d] = past.reduce((n, x) => n + x.clears, 0) / plays
  }
  return out
}

type Props = { overview: Overview; queue: QueueData | null; notify: Notify; reload: () => void; onReview: () => void }

export function TodayTab({ overview, queue, notify, reload, onReview }: Props) {
  const { today, days } = overview
  const tomorrow = addDays(today, 1)
  const avg = averages(days, today)
  const plan = queue ? buildPlan(queue) : null
  const unreviewed = overview.queue.reduce((n, q) => n + (q.unreviewed ?? 0), 0)
  const firstUnreviewed = plan?.find(e => e.kind === 'expected' && e.item.reviewed_at === null)

  return (
    <div className="grid gap-4">
      <Todos overview={overview} unreviewed={unreviewed} firstDate={firstUnreviewed?.date ?? null} onReview={onReview} />
      <div className="grid gap-4 md:grid-cols-2">
        <TodayCard day={days.find(d => d.date === today) ?? null} today={today} avg={avg} />
        <TomorrowCard day={days.find(d => d.date === tomorrow) ?? null} date={tomorrow} notify={notify} reload={reload} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RatesCard days={days} today={today} avg={avg} />
        <div className="grid content-start gap-4">
          <QueueCard overview={overview} lastDate={plan?.at(-1)?.date ?? null} notify={notify} reload={reload} />
          <div className="grid grid-cols-2 gap-4">
            <Tile label="커뮤니티" value={overview.community?.n ?? 0} unit="개" />
            <Tile label="기기" value={overview.players.toLocaleString('ko-KR')} unit="대" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 할 일 줄. 운영자가 움직여야 할 것만 쌓이고, 없으면 사라진다(시안 규칙 4) */
function Todos({ overview, unreviewed, firstDate, onReview }: { overview: Overview; unreviewed: number; firstDate: string | null; onReview: () => void }) {
  const { last, canDispatch } = overview.refill
  const total = overview.queue.reduce((n, q) => n + q.n, 0)
  const warnings: string[] = []
  if (!canDispatch) warnings.push('Worker에 GITHUB_DISPATCH_TOKEN이 없어 대기열이 줄어도 자동으로 채우지 못해요.')
  else if (last && !last.ok) warnings.push(`${kstTime(last.at)}에 문제 채우기를 부르지 못했어요. 토큰이 만료됐는지 확인해 주세요. 자동으로는 다음 날 다시 불러요.`)
  if (total < LOW_QUEUE && !(last?.ok && Date.now() - last.at < DAY_MS)) warnings.push(`남은 문제가 ${total}개예요. 문제 채우기가 아직 불리지 않았어요.`)
  if (!unreviewed && !warnings.length) return null
  return (
    <div className="grid gap-2">
      {unreviewed > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-white py-2.5 pl-4 pr-2.5 sm:pl-5">
          <span className="h-2.5 w-2.5 flex-none rounded-full bg-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-[15px] leading-[22px]">
            <b className="font-semibold text-ink">안 본 문제 {unreviewed}개</b>
            {firstDate && <span className="ml-1.5 text-ink-2 max-sm:hidden">가장 빠른 것은 {monthDay(firstDate)}에 나가요</span>}
          </p>
          <RowButton onClick={onReview}>
            훑어보기
            <ChevronRight className="h-4 w-4" aria-hidden />
          </RowButton>
        </div>
      )}
      {warnings.map(w => (
        <p key={w} className="rounded-2xl bg-[#fdf3d8] px-4 py-3 text-[14px] leading-[21px] text-[#7a5400] sm:px-5">
          {w}
        </p>
      ))}
    </div>
  )
}

function CardHead({ label, number }: { label: string; number: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] font-semibold leading-5 text-ink-2">{label}</span>
      {number !== null && <span className="text-[14px] font-semibold tabular-nums text-primary">#{number}</span>}
    </div>
  )
}

function Num({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <div className="text-[13px] leading-5 text-ink-2">{label}</div>
      <div className="text-[24px] font-bold leading-8 tabular-nums text-primary">
        {value}
        {unit && <span className="ml-0.5 text-[15px] font-semibold">{unit}</span>}
      </div>
    </div>
  )
}

/** 오늘 카드. 도착률 옆에 같은 난이도 날의 평균을 붙여 예상보다 어려웠는지 읽히게 한다 */
function TodayCard({ day, today, avg }: { day: AdminDay | null; today: string; avg: Partial<Record<Difficulty, number>> }) {
  if (!day)
    return (
      <Card>
        <CardHead label={`오늘 ${longDate(today)}`} number={null} />
        <p className="mt-3 text-[15px] text-ink-2">오늘 문제가 없어요. 대기열이 비었는지 확인해 주세요.</p>
      </Card>
    )
  const rate = rateOf(day)
  const base = day.difficulty ? avg[day.difficulty] : undefined
  const compare =
    rate === null
      ? '아직 도전한 사람이 없어요'
      : base === undefined
        ? `지난 ${diffLabel(day.difficulty)} 날이 아직 없어요`
        : Math.abs(rate - base) < 0.03
          ? `${diffLabel(day.difficulty)} 날 평균 ${pct(base)}%와 비슷해요`
          : `${diffLabel(day.difficulty)} 날 평균 ${pct(base)}%보다 ${rate < base ? (base - rate >= 0.1 ? '많이 낮아요' : '조금 낮아요') : rate - base >= 0.1 ? '많이 높아요' : '조금 높아요'}`
  return (
    <Card>
      <CardHead label={`오늘 ${longDate(day.date)}`} number={day.number} />
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <Pair start={day.start_title} end={day.end_title} />
        <DifficultyChip value={day.difficulty} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Num label="도전" value={day.plays.toLocaleString('ko-KR')} unit="명" />
        <Num label="도착" value={day.clears.toLocaleString('ko-KR')} unit="명" />
        <Num label="도착률" value={rate === null ? '–' : pct(rate)} unit={rate === null ? undefined : '%'} />
      </div>
      <p className="mt-2.5 text-[14px] leading-5 text-ink-2">{compare}</p>
    </Card>
  )
}

/** 내일 카드. 아직 아무도 풀지 않아 정답 경로를 펼쳐 둔다 */
function TomorrowCard({ day, date, notify, reload }: { day: AdminDay | null; date: string; notify: Notify; reload: () => void }) {
  const [busy, setBusy] = useState(false)
  if (!day)
    return (
      <Card>
        <CardHead label={`내일 ${longDate(date)}`} number={null} />
        <p className="mt-3 text-[15px] text-ink-2">아직 정해지지 않았어요. 매시 5분에 대기열에서 붙여요.</p>
      </Card>
    )
  const replace = async () => {
    setBusy(true)
    try {
      await adminApi.puzzleAction(day.id, 'replace')
      notify(`${monthDay(day.date)} 문제를 대기열의 다음 문제로 바꿨어요`)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHead label={`내일 ${longDate(day.date)}`} number={day.number} />
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <Pair start={day.start_title} end={day.end_title} />
        <DifficultyChip value={day.difficulty} />
      </div>
      {/* 좁은 화면에서는 칩이 줄을 넘겨 화살표가 끝에 남으므로 한 줄 글자로 */}
      <div className="mt-3.5 max-sm:hidden">
        <SolutionPath start={day.start_title} hops={hopsOf(day.solution)} />
      </div>
      <p className="mt-1.5 truncate text-[14px] leading-5 sm:hidden">
        <PathLine start={day.start_title} solution={day.solution} />
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[14px] text-ink-2">{day.plays > 0 ? '누가 이미 시작했어요' : '0시에 열려요'}</span>
        <ConfirmButton confirm="정말 바꿀까요?" disabled={busy || day.plays > 0} onConfirm={() => void replace()}>
          {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          다른 문제로
        </ConfirmButton>
      </div>
    </Card>
  )
}

const BAR_MAX = 150
const BAR_COLOR: Record<string, string> = { easy: 'bg-s4', normal: 'bg-s3', hard: 'bg-s1' }

/** 최근 14일 도착률. 막대 색이 그날의 난이도라, 초록이 높고 빨강이 낮으면 난이도 예상이 맞은 것이다 */
function RatesCard({ days, today, avg }: { days: AdminDay[]; today: string; avg: Partial<Record<Difficulty, number>> }) {
  const slots = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-[17px] font-bold leading-[25px] text-ink">최근 14일 도착률</h2>
          <p className="mt-0.5 text-[14px] leading-5 text-ink-2">막대 색이 그날의 난이도예요</p>
        </div>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-[14px] leading-5 text-ink-2">
          {DIFF.map(([d, label, color]) => (
            <li key={d} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
              {label}
              <b className="font-semibold tabular-nums text-ink">{avg[d] === undefined ? '–' : `${pct(avg[d])}%`}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 grid items-end gap-1.5 sm:gap-2" style={{ height: BAR_MAX + 12, gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
        {slots.map(date => {
          const d = days.find(x => x.date === date)
          const r = d ? rateOf(d) : null
          const tip = d ? `#${d.number} ${d.start_title} → ${d.end_title}, ${d.plays}명 도전, ${d.clears}명 도착${r === null ? '' : ` (${pct(r)}%)`}` : `${monthDay(date)} 문제 없음`
          return (
            <div key={date} className="flex h-full items-end justify-center" title={tip}>
              {d && r !== null ? (
                <span
                  className={`block w-full max-w-7 rounded-t-md rounded-b-[3px] ${BAR_COLOR[d.difficulty ?? ''] ?? 'bg-[#c5ccd6]'} ${date === today ? 'outline outline-2 outline-offset-2 outline-primary' : ''}`}
                  style={{ height: Math.max(4, Math.round(r * BAR_MAX)) }}
                />
              ) : (
                <span className="block h-1 w-full max-w-7 rounded-full bg-[#e6ecf6]" />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid gap-1.5 text-center text-[12px] leading-4 tabular-nums text-ink-2 sm:gap-2" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
        {slots.map((date, i) => {
          const [, m, d] = date.split('-').map(Number)
          const label = date === today ? '오늘' : i === 0 || d === 1 ? `${m}.${d}` : String(d)
          // 좁은 화면에서는 하루걸러 적는다(첫 날과 오늘은 늘)
          const hide = i % 2 === 1 && date !== today && i !== 0
          return (
            <span key={date} className={`whitespace-nowrap ${date === today ? 'font-bold text-primary' : ''} ${hide ? 'max-sm:invisible' : ''}`}>
              {label}
            </span>
          )
        })}
      </div>
    </Card>
  )
}

/** 남은 문제. "32개"보다 "1월 5일까지"가 필요한 답이다. 문제 채우기 상태와 지금 채우기도 여기에 둔다 */
function QueueCard({ overview, lastDate, notify, reload }: { overview: Overview; lastDate: string | null; notify: Notify; reload: () => void }) {
  const [busy, setBusy] = useState(false)
  const { last, below, canDispatch } = overview.refill
  const count = (d: Difficulty) => overview.queue.find(q => q.difficulty === d)?.n ?? 0
  const total = overview.queue.reduce((n, q) => n + q.n, 0)
  const call = async () => {
    setBusy(true)
    try {
      const r = await adminApi.refill()
      notify(r.ok ? '문제 채우기를 불렀어요. 한 시간쯤 뒤에 대기열이 늘어나요' : `GitHub가 받지 않았어요 (${r.status}). 토큰을 확인해 주세요`)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="!p-4 sm:!px-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold leading-5 text-ink-2">남은 문제</span>
        <span className="text-[14px] tabular-nums text-ink-2">{total}개</span>
      </div>
      <p className="mt-0.5 text-[24px] font-bold leading-8 text-primary">
        {total === 0 ? '남은 문제가 없어요' : lastDate ? monthDay(lastDate) : '계산하는 중'}
        {total > 0 && lastDate && <span className="ml-0.5 text-[15px] font-semibold">까지</span>}
      </p>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {DIFF.map(([d, , color]) => count(d) > 0 && <span key={d} className={color} style={{ flexGrow: count(d) }} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] leading-5 text-ink-2">
            {DIFF.map(([d, label, color]) => (
              <li key={d} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
                {label}
                <b className="font-semibold tabular-nums text-ink">{count(d)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#eef1f5] pt-3">
        <p className="min-w-0 text-[13px] leading-5 text-ink-2">
          {below}개 아래면 자동으로 채워요
          {last && (
            <span className="block">
              {last.ok ? '마지막' : '실패'} {kstTime(last.at)}
            </span>
          )}
        </p>
        <ConfirmButton confirm="40개 더 넣을까요?" disabled={busy || !canDispatch} onConfirm={() => void call()}>
          {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          지금 채우기
        </ConfirmButton>
      </div>
    </Card>
  )
}

function Tile({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <Card className="!p-4 sm:!px-5">
      <div className="text-[14px] font-semibold leading-5 text-ink-2">{label}</div>
      <div className="mt-0.5 text-[24px] font-bold leading-8 tabular-nums text-primary">
        {value}
        <span className="ml-0.5 text-[15px] font-semibold">{unit}</span>
      </div>
    </Card>
  )
}

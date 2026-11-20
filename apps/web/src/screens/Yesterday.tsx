import { useState, type ReactNode } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { binMoves, formatClock, formatDurationShort, type DailyRecord, type YesterdayStats } from '@linkle/core'
import { useStats } from '../game/stats'
import { useYesterday } from '../game/yesterday'
import { wikiUrl } from '../ui/license'
import { Card, formatDateKo, kindOfEmoji, Parts, PathStep, Route, StatTile, TextButton } from '../ui/cards'

/**
 * 어제의 기록. 누가 1등인지가 아니라 어제 사람들이 언제, 어떻게 도착했는지를 보여 준다.
 * 실시간 순위는 두지 않는다(설계 문서 8장). 기록은 위키백과에서 경로를 확인한 것만 오른다.
 */
export function Yesterday() {
  const { data, error, retry } = useYesterday()
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="pb-4 pt-5">
        <h1 className="text-[22px] font-bold leading-[31px] text-ink">어제의 기록</h1>
        <p className="h-[22px] text-[15px] leading-[22px] text-ink-2">{data && data.status !== 'none' ? `${formatDateKo(data.date)}, ${data.number}번째 링클` : ''}</p>
      </header>
      {data === null ? (
        error ? (
          <Notice title="기록을 불러오지 못했어요" body="잠시 뒤에 다시 시도해 주세요.">
            <TextButton onClick={retry} className="-ml-4 mt-2">
              다시 불러오기
            </TextButton>
          </Notice>
        ) : (
          <Skeleton />
        )
      ) : data.status === 'none' ? (
        <Notice title="어제는 문제가 없었어요" body="오늘 문제를 풀면 내일 여기에서 사람들의 기록과 함께 볼 수 있어요." />
      ) : data.status === 'pending' ? (
        <Notice title="어제 기록을 모으고 있어요" body="자정이 지나고 몇 분 뒤에 열려요. 조금 뒤에 다시 와 주세요." />
      ) : (
        <DayStats stats={data} />
      )}
    </main>
  )
}

/** 그날의 기록 전체. 어제의 기록과, 지난 문제를 푼 뒤의 비교에 함께 쓴다 */
/** head가 거짓이면 출발·도착 카드를 뺀다(지난 문제 화면처럼 위에 이미 있을 때) */
export function DayStats({ stats, head = true }: { stats: YesterdayStats; head?: boolean }) {
  const mine = useStats(s => s.stats.recent[stats.date])
  return (
    <div className="flex flex-col gap-3">
      {head && (
        <Card lift aria-label="어제의 문제">
          <Route start={stats.start.title} end={stats.end.title} />
          <p className="mt-3 text-center text-[15px] leading-[22px] text-ink-2">
            {stats.finished > 0 ? (
              <>
                <b className="font-semibold tabular-nums text-ink">{stats.finished.toLocaleString('ko-KR')}명</b>이 도착했어요
              </>
            ) : (
              '어제는 아무도 도착하지 못했어요'
            )}
          </p>
          {mine && (
            <p className="mt-3 rounded-xl bg-secondary px-4 py-2.5 text-center text-[15px] leading-[22px] text-ink">
              <span className="mb-px mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden />
              <span>
                나는 <b className="font-semibold tabular-nums text-primary">{mine.moves}번</b>, <b className="font-semibold tabular-nums text-primary">{formatDurationShort(mine.ms)}</b> 만에 도착했어요
              </span>
            </p>
          )}
        </Card>
      )}

      {stats.finished > 0 && (
        <>
          <dl className="grid grid-cols-3 gap-2">
            <StatTile label="최단" value={stats.shortest?.moves ?? null} unit="번" />
            <StatTile label="가장 빨리" value={stats.fastest ? formatClock(stats.fastest.durationMs) : null} />
            <StatTile label="가운데" value={stats.medianMs === null ? null : formatClock(stats.medianMs)} />
          </dl>
          <Distribution counts={stats.moves} mine={mine?.moves ?? null} total={stats.finished} />
          <ShortestPath record={stats.shortest} verifying={stats.verifying} />
          {stats.topPages.length > 0 && <TopPages pages={stats.topPages} total={stats.finished} />}
        </>
      )}
    </div>
  )
}

export function CardTitle({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-bold leading-[25px] text-ink">{children}</h2>
      {side && <span className="flex-none text-[14px] leading-5 text-ink-2">{side}</span>}
    </div>
  )
}

/** 이동 횟수 분포. 내가 속한 칸은 파랑이다. 다른 사람과 비교하는 것이 아니라 어제의 모양을 보여 준다 */
function Distribution({ counts, mine, total }: { counts: Record<number, number>; mine: number | null; total: number }) {
  const bins = binMoves(counts)
  const max = Math.max(...bins.map(b => b.count), 1)
  return (
    <Card aria-label="이동 횟수 분포">
      <CardTitle side={`${total.toLocaleString('ko-KR')}명`}>이동 횟수</CardTitle>
      <ol className="grid gap-1.5">
        {bins.map(b => {
          const me = mine !== null && mine >= b.from && mine <= b.to
          return (
            <li key={b.label} className="grid grid-cols-[44px_1fr] items-center text-[13px] text-ink-2">
              <span className={me ? 'font-semibold text-primary' : ''}>{b.label}</span>
              <span className="flex h-[22px] items-center">
                <i
                  className={`flex h-full min-w-[26px] items-center justify-end rounded-md px-2 text-[13px] font-semibold not-italic tabular-nums ${me ? 'bg-primary text-white' : b.count === 0 ? 'bg-[#eef1f5] font-medium text-ink-2' : 'bg-[#e3e9f4] text-ink'}`}
                  style={{ width: `${(b.count / max) * 100}%` }}
                >
                  {b.count}
                </i>
              </span>
            </li>
          )
        })}
      </ol>
      {mine !== null && <p className="mt-3 text-[13px] leading-[18px] text-ink-2">파란 칸이 내가 도착한 횟수예요.</p>}
    </Card>
  )
}

/** 가장 짧은 길. 직접 찾아보고 싶은 사람을 위해 눌러야 열린다 */
function ShortestPath({ record, verifying }: { record: DailyRecord | null; verifying: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Card aria-label="가장 짧은 길">
      <CardTitle side={record ? <Parts className="tabular-nums" items={[`${record.moves}번`, formatClock(record.durationMs)]} /> : undefined}>가장 짧은 길</CardTitle>
      {!record ? (
        <p className="text-[15px] leading-[22px] text-ink-2">{verifying ? '위키백과에서 기록을 확인하고 있어요.' : '확인된 기록이 없어요.'}</p>
      ) : open ? (
        <ol>
          {record.path.map((p, i) => {
            const last = i === record.path.length - 1
            const kind = i === 0 ? 'start' : record.emoji ? kindOfEmoji(record.emoji[i - 1]!) : p.back ? 'back' : last ? 'goal' : 'unknown'
            return <PathStep key={i} kind={kind} title={p.title} note={i === 0 ? '출발' : p.back ? '되돌아감' : last ? '도착' : undefined} strong={i === 0 || last} muted={p.back} href={wikiUrl(p.title)} />
          })}
        </ol>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] leading-[22px] text-ink-2">어떤 길로 갔는지 볼까요?</p>
          <TextButton onClick={() => setOpen(true)} className="-mr-4 flex-none">
            길 보기
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
          </TextButton>
        </div>
      )}
    </Card>
  )
}

/** 어제 사람들이 많이 지나간 문서. 비율은 도착한 사람 중 그 문서를 지난 사람 */
function TopPages({ pages, total }: { pages: YesterdayStats['topPages']; total: number }) {
  return (
    <Card aria-label="많이 지나간 문서">
      <CardTitle>많이 지나간 문서</CardTitle>
      <ol className="grid gap-3.5">
        {pages.map((p, i) => {
          const share = Math.round((p.count / total) * 100)
          return (
            <li key={p.id} className="flex items-center gap-3">
              <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-bold ${i === 0 ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium leading-[22px] text-ink">{p.title}</span>
                  <span className="flex-none text-[13px] tabular-nums text-ink-2">{share}%</span>
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} />
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

export function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <Card>
      <p className="text-[17px] font-bold leading-[25px] text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{body}</p>
      {children}
    </Card>
  )
}

export function Skeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
      {[132, 76, 220].map(h => (
        <div key={h} className="animate-pulse rounded-[20px] bg-white/70" style={{ height: h }} />
      ))}
    </div>
  )
}

/** 홈에서 오늘을 끝낸 뒤 보이는 어제의 링클 미리보기 */
export function YesterdayPreview() {
  const { data } = useYesterday()
  if (!data || data.status !== 'ready' || data.finished === 0) return null
  return (
    <Link to="/yesterday" className="press block rounded-[20px] focus-visible:outline-2 focus-visible:outline-primary">
      <Card aria-label="어제의 링클">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold leading-[22px] text-primary">어제의 링클</span>
          <span className="flex items-center text-[14px] font-medium text-primary">
            기록 보기
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[16px] font-semibold leading-6 text-ink">
          <span className="font-brand font-normal text-primary">#{data.number}</span>
          <span className="truncate">{data.start.title}</span>
          <ArrowRight className="h-4 w-4 flex-none text-[#9db4dd]" aria-hidden />
          <span className="truncate">{data.end.title}</span>
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <StatTile className="bg-secondary" label="도착" value={data.finished.toLocaleString('ko-KR')} unit="명" />
          <StatTile className="bg-secondary" label="최단" value={data.shortest?.moves ?? null} unit="번" />
          <StatTile className="bg-secondary" label="가운데" value={data.medianMs === null ? null : formatClock(data.medianMs)} />
        </dl>
      </Card>
    </Link>
  )
}

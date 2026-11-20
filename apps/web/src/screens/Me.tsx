import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Share, SquarePlus } from 'lucide-react'
import { Link } from 'react-router'
import { addMonths, averageMoves, bestsOf, formatClock, formatDurationShort, kstDate, monthGrid, nicknameOf, streakOn, type Stats } from '@linkle/core'
import { playerId } from '../game/player'
import { useInstall } from '../game/pwa'
import { useStats } from '../game/stats'
import { now, useGame } from '../game/store'
import { Card, Cta, formatDateKo, StatTile } from '../ui/cards'
import { Flame, streakLine } from '../ui/Streak'
import { Distribution } from './Yesterday'

/**
 * 내 기록 (/me). 오늘의 문제만 센다. 로그인이 없으므로 모두 이 기기에 저장된 것이다.
 *   연속 기록과 달력: 푼 날을 파랑으로, 이어진 날은 옅은 띠로 잇는다. 푼 날을 누르면 그날의 결과가 보인다
 *   숫자: 푼 날, 최고 연속, 평균 이동, 가장 적은 이동, 가장 빠른 도착
 *   이동 횟수 분포
 *   이 기기 안내와 홈 화면에 추가
 * 랭킹이나 다른 사람과의 비교는 두지 않는다(설계 문서 8장과 같은 이유).
 */
export function Me() {
  const stats = useStats(s => s.stats)
  const today = useGame(s => s.today?.date) ?? kstDate(now())
  const empty = stats.played === 0

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to="/" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />홈
        </Link>
      </header>
      <h1 className="pb-4 text-[22px] font-bold leading-[31px] text-ink">내 기록</h1>

      <div className="flex flex-col gap-3">
        {empty ? <Empty /> : <Records stats={stats} today={today} />}
        <Device />
      </div>
    </main>
  )
}

function Empty() {
  return (
    <Card lift aria-label="내 기록">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-[#f1f4f8]">
          <Flame size={36} lit={false} />
        </span>
        <div className="min-w-0">
          <p className="text-[18px] font-bold leading-[26px] text-ink">아직 기록이 없어요</p>
          <p className="text-[15px] leading-[22px] text-ink-2">오늘의 링클을 풀면 연속 기록과 이동 횟수가 여기에 쌓여요.</p>
        </div>
      </div>
      <Link to="/" className="press mt-5 flex h-14 w-full items-center justify-center rounded-full bg-primary text-[17px] font-semibold text-white">
        오늘의 링클 풀기
      </Link>
    </Card>
  )
}

function Records({ stats, today }: { stats: Stats; today: string }) {
  const s = streakOn(stats, today)
  const avg = averageMoves(stats)
  const bests = useMemo(() => bestsOf(stats), [stats])
  const last = stats.lastDate ? stats.recent[stats.lastDate] : undefined

  return (
    <>
      <Card lift aria-label="연속 기록">
        <div className="flex items-center gap-4">
          <span className={`grid h-16 w-16 flex-none place-items-center rounded-full ${s.doneToday ? 'bg-flame-soft' : 'bg-[#f1f4f8]'}`}>
            <Flame size={36} lit={s.doneToday} live />
          </span>
          <div className="min-w-0">
            <p className="text-[26px] font-bold leading-[34px] text-ink">
              <span className={`tabular-nums ${s.doneToday ? 'text-flame' : ''}`}>{s.count}</span>일 연속
            </p>
            <p className="text-[15px] leading-[22px] text-ink-2">{streakLine(s.count, s.doneToday, s.atRisk)}</p>
          </div>
        </div>
        <Calendar stats={stats} today={today} />
      </Card>

      <dl className="grid grid-cols-3 gap-2">
        <StatTile label="푼 날" value={stats.played.toLocaleString('ko-KR')} unit="일" />
        <StatTile label="최고 연속" value={stats.maxStreak} unit="일" />
        <StatTile label="평균 이동" value={avg === null ? null : avg.toFixed(1)} unit="번" />
      </dl>
      <dl className="grid grid-cols-2 gap-2">
        <StatTile label="가장 적은 이동" value={bests.fewest?.moves ?? null} unit="번" />
        <StatTile label="가장 빠른 도착" value={bests.fastest ? formatClock(bests.fastest.ms) : null} />
      </dl>

      <Distribution counts={stats.moves} mine={last?.moves ?? null} total={stats.played} unit="일" note="파란 칸이 가장 최근에 푼 날의 이동 횟수예요." />
    </>
  )
}

const WEEK_HEAD = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 한 달 달력. 푼 날은 파란 원, 이어서 푼 날끼리는 옅은 띠로 잇는다(같은 줄 안에서만).
 * 볼 수 있는 달은 처음 푼 달부터 이번 달까지다.
 */
function Calendar({ stats, today }: { stats: Stats; today: string }) {
  const done = useMemo(() => new Set(stats.days), [stats.days])
  const thisMonth = today.slice(0, 7)
  const firstMonth = [...stats.days].sort()[0]?.slice(0, 7) ?? thisMonth
  const [month, setMonth] = useState(thisMonth)
  const [picked, setPicked] = useState<string | null>(stats.lastDate)
  const cells = monthGrid(month)
  const [y, m] = month.split('-').map(Number) as [number, number]
  const solvedHere = cells.filter(d => d && done.has(d)).length
  const pick = picked && picked.startsWith(month) && done.has(picked) ? picked : null
  const result = pick ? stats.recent[pick] : undefined

  return (
    <section className="mt-5 border-t border-[#eef1f5] pt-4" aria-label="달력">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[17px] font-bold leading-[25px] text-ink">
          {y}년 {m}월
        </h2>
        <div className="-mr-2 flex">
          <MonthButton label="이전 달" disabled={month <= firstMonth} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </MonthButton>
          <MonthButton label="다음 달" disabled={month >= thisMonth} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </MonthButton>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[12px] font-medium leading-6 text-ink-2" aria-hidden>
        {WEEK_HEAD.map(w => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <li key={`pad-${i}`} aria-hidden />
          const solved = done.has(d)
          const col = i % 7
          // 띠: 앞날도 풀었으면 왼쪽 반, 다음 날도 풀었으면 오른쪽 반. 줄 끝에서는 끊는다
          const joinL = solved && col > 0 && done.has(prevDay(d))
          const joinR = solved && col < 6 && done.has(nextDay(d))
          const isToday = d === today
          const future = d > today
          const day = Number(d.slice(8))
          const label = `${m}월 ${day}일${isToday ? ' 오늘' : ''}${solved ? ', 풀었어요' : ''}`
          return (
            <li key={d} className="relative flex h-10 items-center justify-center">
              {joinL && <i className="absolute inset-y-[3px] left-0 right-1/2 bg-flame-soft" aria-hidden />}
              {joinR && <i className="absolute inset-y-[3px] left-1/2 right-0 bg-flame-soft" aria-hidden />}
              {solved ? (
                <button
                  onClick={() => setPicked(d)}
                  aria-label={label}
                  aria-pressed={pick === d}
                  className={`press relative grid h-[34px] w-[34px] place-items-center rounded-full bg-primary text-[14px] font-semibold tabular-nums text-white ${pick === d ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  {day}
                </button>
              ) : (
                <span
                  aria-label={label}
                  className={`relative grid h-[34px] w-[34px] place-items-center rounded-full text-[14px] tabular-nums ${
                    isToday ? 'font-semibold text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]' : future ? 'text-[#c5ccd6]' : 'text-ink-2'
                  }`}
                >
                  {day}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-3 min-h-[44px] rounded-xl bg-secondary px-4 py-2.5 text-center text-[14px] leading-[22px] text-ink" aria-live="polite">
        {pick ? (
          <>
            <b className="font-semibold">{formatDateKo(pick)}</b>
            {result ? (
              <>
                {'에 '}
                <b className="font-semibold tabular-nums text-primary">{result.moves}번</b>, <b className="font-semibold tabular-nums text-primary">{formatDurationShort(result.ms)}</b> 만에 도착했어요
              </>
            ) : (
              '에 풀었어요'
            )}
          </>
        ) : solvedHere > 0 ? (
          `${m}월에는 ${solvedHere}일 풀었어요. 날짜를 누르면 그날의 기록이 보여요`
        ) : (
          '이 달에는 푼 날이 없어요'
        )}
      </p>
    </section>
  )
}

function MonthButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="press grid h-9 w-9 place-items-center rounded-full text-ink disabled:text-[#c5ccd6]">
      {children}
    </button>
  )
}

const prevDay = (d: string) => shift(d, -1)
const nextDay = (d: string) => shift(d, 1)
function shift(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** 이 기기에만 남는다는 안내와 홈 화면에 추가 */
function Device() {
  const { mode, install } = useInstall()
  const name = useMemo(() => nicknameOf(playerId()), [])
  return (
    <Card aria-label="이 기기">
      <h2 className="text-[17px] font-bold leading-[25px] text-ink">기록은 이 기기에 있어요</h2>
      <p className="mt-1 text-[15px] leading-[23px] text-ink-2">링클은 로그인이 없어서 기록이 이 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 다른 기기에서 열면 처음부터 시작해요.</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-2.5 text-[14px] leading-[22px]">
        <span className="flex-none text-ink-2">순위표 이름</span>
        <span className="truncate font-semibold text-ink">{name}</span>
      </div>

      {mode === 'prompt' && (
        <>
          <p className="mt-4 text-[15px] leading-[23px] text-ink-2">홈 화면에 두면 앱처럼 바로 열리고, 기록도 더 오래 남아요.</p>
          <Cta onClick={() => void install()} className="mt-3">
            <SquarePlus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            홈 화면에 추가
          </Cta>
        </>
      )}
      {mode === 'ios' && (
        <div className="mt-4">
          <p className="text-[15px] leading-[23px] text-ink-2">홈 화면에 두면 앱처럼 바로 열리고, 기록도 더 오래 남아요.</p>
          <ol className="mt-3 grid gap-2 text-[15px] leading-[22px] text-ink">
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-secondary text-primary">
                <Share className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              사파리의 공유 버튼을 눌러요
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-secondary text-primary">
                <SquarePlus className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              &lsquo;홈 화면에 추가&rsquo;를 골라요
            </li>
          </ol>
        </div>
      )}
    </Card>
  )
}

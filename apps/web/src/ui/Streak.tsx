import { useEffect, useId, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { streakOn, weekOf, type Stats, type WeekDay } from '@linkle/core'
import './streak.css'

const FLAME = 'M12.4 2.2c.5 3.3 2.4 5.2 4.1 7.2 1.6 1.9 3 3.9 3 6.9a7.5 7.5 0 0 1-15 0c0-2.3 1-4.2 2.3-5.6.3 1.5 1 2.5 2.1 3-.4-4.1.9-8.3 3.5-11.5z'
const CORE = 'M12 21.6a3.7 3.7 0 0 0 3.7-3.7c0-1.6-1-2.6-1.9-3.7-.8-.9-1.5-1.8-1.8-3.1-.3 1.3-1 2.2-1.8 3.1-.9 1.1-1.9 2.1-1.9 3.7a3.7 3.7 0 0 0 3.7 3.7z'

/** 연속 기록의 불꽃. 오늘 풀었으면 타오르고, 아직이면 회색으로 꺼져 있다 */
export function Flame({ size = 24, lit = true, live = false, className = '' }: { size?: number; lit?: boolean; live?: boolean; className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`flame ${live && lit ? 'flame--live' : ''} ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb224" />
          <stop offset="1" stopColor="#ff6f00" />
        </linearGradient>
      </defs>
      <path d={FLAME} fill={lit ? `url(#${id})` : '#cbd3dd'} />
      {lit && <path className="flame__core" d={CORE} fill="#ffe27a" />}
    </svg>
  )
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 이번 주 일곱 칸. 푼 날은 불꽃색, 오늘은 테두리, 놓친 날은 회색 */
export function WeekRow({ week, litDate }: { week: WeekDay[]; /** 방금 채워진 날. 채워지는 움직임을 준다 */ litDate?: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="이번 주">
      {week.map(d => {
        const today = d.state === 'today'
        const label = `${WEEKDAYS[d.weekday]}요일 ${d.state === 'done' ? '풀었어요' : today ? '오늘' : d.state === 'missed' ? '풀지 않았어요' : ''}`
        return (
          <li key={d.date} className="flex flex-col items-center gap-1.5" aria-label={label}>
            <span className={`text-[13px] leading-[18px] ${today || d.date === litDate ? 'font-semibold text-ink' : 'text-ink-2'}`}>{WEEKDAYS[d.weekday]}</span>
            <span
              className={`relative grid h-9 w-9 place-items-center rounded-full ${
                d.state === 'done'
                  ? `bg-gradient-to-b from-[#ffb224] to-[#ff7a00] text-white ${d.date === litDate ? 'day--lit' : ''}`
                  : today
                    ? 'day--today bg-flame-soft'
                    : d.state === 'missed'
                      ? 'bg-[#e9edf3]'
                      : 'bg-white shadow-[inset_0_0_0_1.5px_#e3e8ef]'
              }`}
            >
              {d.state === 'done' && <Check className="h-[18px] w-[18px]" strokeWidth={3} aria-hidden />}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** 홈 위쪽의 작은 칩. 누르면 연속 기록 카드로 내려간다 */
export function StreakChip({ stats, today, onClick }: { stats: Stats; today: string; onClick?: () => void }) {
  const s = streakOn(stats, today)
  if (stats.played === 0) return null
  return (
    <button onClick={onClick} className="press inline-flex h-9 items-center gap-1 rounded-full bg-white pl-2.5 pr-3.5 text-[15px] font-bold tabular-nums text-ink" aria-label={`연속 ${s.count}일`}>
      <Flame size={20} lit={s.doneToday} />
      <span className={s.doneToday ? 'text-flame' : 'text-ink-2'}>{s.count}</span>
    </button>
  )
}

function streakLine(count: number, doneToday: boolean, atRisk: boolean): string {
  if (doneToday) return count >= 2 ? '오늘도 이어 갔어요' : '연속 기록을 시작했어요'
  if (atRisk) return `오늘 풀면 ${count + 1}일째예요`
  return '오늘 풀면 다시 시작돼요'
}

/** 홈의 연속 기록 카드: 불꽃과 큰 숫자, 한 줄 문구, 이번 주 */
export function StreakCard({ stats, today }: { stats: Stats; today: string }) {
  const s = streakOn(stats, today)
  return (
    <section className="rounded-[20px] bg-white p-5" aria-label="연속 기록">
      <div className="mb-4 flex items-center gap-3">
        <span className={`grid h-14 w-14 flex-none place-items-center rounded-full ${s.doneToday ? 'bg-flame-soft' : 'bg-[#f1f4f8]'}`}>
          <Flame size={32} lit={s.doneToday} live />
        </span>
        <div className="min-w-0">
          <p className="text-[22px] font-bold leading-[31px] text-ink">
            <span className={`tabular-nums ${s.doneToday ? 'text-flame' : ''}`}>{s.count}</span>일 연속
          </p>
          <p className="text-[15px] leading-[22px] text-ink-2">{streakLine(s.count, s.doneToday, s.atRisk)}</p>
        </div>
        {stats.maxStreak > s.count && <p className="ml-auto self-start whitespace-nowrap text-[13px] leading-[18px] text-ink-2">최고 {stats.maxStreak}일</p>}
      </div>
      <WeekRow week={weekOf(stats, today)} />
    </section>
  )
}

const MILESTONE: Record<number, string> = { 7: '일주일을 채웠어요', 30: '한 달을 채웠어요', 100: '100일을 채웠어요', 365: '1년을 채웠어요' }
const BIT_COLORS = ['var(--color-s1)', 'var(--color-s2)', 'var(--color-s3)', 'var(--color-s4)', 'var(--color-s5)']

/**
 * 연속 일수가 늘어난 직후 한 번 뜨는 화면. 불꽃이 튀어 오르고 숫자가 하나 올라가고 오늘 칸이 채워진다.
 * 겁주는 말은 쓰지 않는다. 끊겨도 알리지 않고, 이어 갔을 때만 축하한다.
 */
export function StreakCelebration({ stats, today, onDone }: { stats: Stats; today: string; onDone: () => void }) {
  const count = stats.streak
  const [shown, setShown] = useState(Math.max(count - 1, 0))
  useEffect(() => {
    const t = setTimeout(() => setShown(count), 650)
    return () => clearTimeout(t)
  }, [count])
  const special = MILESTONE[count]
  const bits = Array.from({ length: special ? 22 : 12 }, (_, i) => {
    const angle = (i / (special ? 22 : 12)) * Math.PI * 2 + 0.3
    const far = 120 + ((i * 37) % 70)
    return { '--dx': `${Math.cos(angle) * far}px`, '--dy': `${Math.sin(angle) * far - 30}px`, '--rot': `${(i * 67) % 360}deg`, background: BIT_COLORS[i % 5], animationDelay: `${650 + (i % 4) * 40}ms` } as CSSProperties
  })
  return (
    <div
      className="cel fixed inset-0 z-50 flex flex-col items-center gap-4 overflow-y-auto bg-secondary px-6 pb-[max(20px,env(safe-area-inset-bottom))] pl-[max(24px,env(safe-area-inset-left))] pr-[max(24px,env(safe-area-inset-right))] pt-[max(24px,env(safe-area-inset-top))] short:flex-row short:justify-center short:gap-10"
      role="dialog"
      aria-modal="true"
      aria-label={`연속 ${count}일`}
    >
      {/* 세로 화면: 불꽃 → 문구 → 이번 주 → 버튼. 눕힌 화면: 왼쪽에 불꽃과 숫자, 오른쪽에 나머지 */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-end short:w-auto short:flex-none short:justify-center">
        <div className="relative grid h-40 w-40 place-items-center short:h-28 short:w-28">
          <span className="cel__glow absolute inset-0 rounded-full bg-[radial-gradient(closest-side,#ffe3b3,transparent)]" />
          {shown === count && bits.map((style, i) => <i key={i} className="cel__bit" style={style} />)}
          <Flame size={120} live className="cel__flame relative short:!h-20 short:!w-20" />
        </div>
        <p className="mt-2 text-[64px] font-extrabold leading-none tabular-nums text-flame short:mt-0 short:text-[52px]" aria-live="polite">
          <span key={shown} className="cel__num">
            {shown}
          </span>
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-1 flex-col items-center short:justify-center">
        <h2 className="cel__rise text-[26px] font-bold leading-[35px] text-ink short:text-[22px] short:leading-[31px]" style={{ animationDelay: '0.3s' }}>
          {count === 1 ? '연속 기록 시작!' : `${count}일 연속!`}
        </h2>
        <p className="cel__rise mt-1 text-center text-[17px] leading-[25.5px] text-ink-2" style={{ animationDelay: '0.4s' }}>
          {special ?? (count === 1 ? '내일도 풀면 2일째가 돼요' : '내일도 이어 가 봐요')}
        </p>
        <div className="cel__rise mt-8 w-full rounded-[20px] bg-white p-5 short:mt-4 short:p-4" style={{ animationDelay: '0.5s' }}>
          <WeekRow week={weekOf(stats, today)} litDate={shown === count ? today : undefined} />
        </div>
        <button onClick={onDone} autoFocus className="press mt-auto h-14 w-full flex-none rounded-full bg-primary text-[17px] font-semibold text-white short:mt-4">
          계속
        </button>
      </div>
    </div>
  )
}

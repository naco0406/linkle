import { useEffect, useId, useState, type CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { streakOn, weekOf, type Stats, type WeekDay } from '@linkle/core'
import './streak.css'

// Lucide의 flame과 같은 꼴을 절대 좌표로 옮긴 것. 아래 탭, 게임 방법, 깃발과 같은 선 아이콘 언어다(2026-11-20, 후보 B)
const FLAME = 'M8.5 14.5A2.5 2.5 0 0 0 11 12C11 10.62 10.5 10 10 9C8.93 6.86 9.78 4.95 12 3C12.5 5.5 14 7.9 16 9.5C18 11.1 19 13 19 15A7 7 0 1 1 5 15C5 13.85 5.43 12.71 6 12A2.5 2.5 0 0 0 8.5 14.5Z'
// 불끝이 오른쪽, 왼쪽으로 흔들린 꼴. 명령 순서가 같아야 사이를 부드럽게 바꿔 그린다
const FLAME_R = 'M8.6 14.4A2.5 2.5 0 0 0 11.1 11.9C11.1 10.5 10.7 9.9 10.3 8.9C9.4 6.7 10.4 4.7 12.9 2.6C13.2 5.3 14.4 7.8 16.2 9.4C18.1 11.1 19 13 19 15A7 7 0 1 1 5 15C5 13.8 5.5 12.5 6.2 11.7A2.6 2.6 0 0 0 8.6 14.4Z'
const FLAME_L = 'M8.4 14.6A2.5 2.5 0 0 0 10.9 12.1C10.9 10.7 10.3 10.1 9.8 9.1C8.6 7 9.2 5.1 11.3 3.3C12 5.8 13.7 8 15.8 9.6C17.9 11.2 19 13 19 15A7 7 0 1 1 5 15C5 13.9 5.4 12.8 5.9 12.2A2.4 2.4 0 0 0 8.4 14.6Z'
const FLICKER = [FLAME, FLAME_R, FLAME, FLAME_L, FLAME].join(';')

/** 움직임 줄이기 설정. 켜져 있으면 불꽃은 가만히 있다 */
function useReducedMotion(): boolean {
  const [reduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

/**
 * 연속 기록의 불꽃. 다른 아이콘과 같은 선 아이콘이다.
 *   켜짐  파란 선 + 옅은 파랑으로 채움
 *   꺼짐  회색 선만
 * live   불끝이 좌우로 살아 움직인다(모양 자체가 바뀐다. 통째로 흔들지 않는다)
 * ignite 축하 화면용. 회색으로 꺼져 있다가 IGNITE_AT에 선이 파래지고, 안이 아래에서 위로 차오른다
 * 큰 크기에서는 선이 너무 두꺼워 보이지 않게 조금 가늘게 한다.
 */
export const IGNITE_AT = 0.55

export function Flame({ size = 24, lit = true, live = false, ignite = false, className = '' }: { size?: number; lit?: boolean; live?: boolean; ignite?: boolean; className?: string }) {
  const clip = useId()
  const reduced = useReducedMotion()
  const stroke = size >= 64 ? 1.5 : 1.75
  const moving = live && lit && !reduced
  const burning = ignite && lit && !reduced
  const flicker = moving ? <animate attributeName="d" values={FLICKER} dur="1.7s" begin={burning ? `${IGNITE_AT + 0.7}s` : '0s'} repeatCount="indefinite" calcMode="spline" keyTimes="0;0.25;0.5;0.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" /> : null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`flame ${burning ? 'flame--ignite' : ''} ${className}`} aria-hidden>
      {lit && (
        <>
          <defs>
            <clipPath id={clip}>
              {/* 차오르는 물높이. 불이 붙을 때 아래에서 위로 올라온다 */}
              <rect x="0" width="24" height="26" y={burning ? 24 : -2}>
                {burning && <animate attributeName="y" from="24" to="-2" begin={`${IGNITE_AT + 0.05}s`} dur="0.55s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .3 1" />}
              </rect>
            </clipPath>
          </defs>
          <path d={FLAME} fill="#dce7fa" clipPath={`url(#${clip})`}>
            {flicker}
          </path>
        </>
      )}
      <path className="flame__line" d={FLAME} fill="none" stroke={lit ? 'var(--color-primary)' : '#9aa5b1'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {flicker}
      </path>
    </svg>
  )
}

/** 체크 표시를 그리는 선. 방금 채워진 칸에서는 선이 그어지듯 나타난다 */
function DrawnCheck({ draw }: { draw: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${draw ? 'check--draw' : ''}`} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  )
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 연속 기록의 일곱 칸(지금 기록의 첫날부터). 푼 날은 파랑, 오늘은 테두리, 놓친 날은 회색 */
export function WeekRow({ week, litDate }: { week: WeekDay[]; /** 방금 채워진 날. 채워지는 움직임을 준다 */ litDate?: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="연속 기록 일곱 날">
      {week.map(d => {
        const today = d.state === 'today'
        const label = `${WEEKDAYS[d.weekday]}요일 ${d.state === 'done' ? '풀었어요' : today ? '오늘' : d.state === 'missed' ? '풀지 않았어요' : ''}`
        return (
          <li key={d.date} className="flex flex-col items-center gap-1.5" aria-label={label}>
            <span className={`text-[13px] leading-[18px] ${today || d.date === litDate ? 'font-semibold text-ink' : 'text-ink-2'}`}>{WEEKDAYS[d.weekday]}</span>
            <span
              className={`relative grid h-9 w-9 place-items-center rounded-full ${
                d.state === 'done'
                  ? `bg-primary text-white ${d.date === litDate ? 'day--lit' : ''}`
                  : today
                    ? 'day--today bg-flame-soft'
                    : d.state === 'missed'
                      ? 'bg-[#e9edf3]'
                      : 'bg-white shadow-[inset_0_0_0_1.5px_#e3e8ef]'
              }`}
            >
              {d.state === 'done' && <DrawnCheck draw={d.date === litDate} />}
              {d.date === litDate && d.state === 'done' && <i className="day__burst" aria-hidden />}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** 홈 위쪽의 작은 칩. 누르면 내 기록으로 간다 */
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

export function streakLine(count: number, doneToday: boolean, atRisk: boolean): string {
  if (doneToday) return count >= 2 ? '오늘도 이어 갔어요' : '연속 기록을 시작했어요'
  if (atRisk) return `오늘 풀면 ${count + 1}일째예요`
  return '오늘 풀면 다시 시작돼요'
}

/** 홈의 연속 기록 카드: 불꽃과 큰 숫자, 한 줄 문구, 이번 주. 누르면 내 기록으로 간다 */
export function StreakCard({ stats, today }: { stats: Stats; today: string }) {
  const s = streakOn(stats, today)
  return (
    <Link to="/me" className="press block rounded-[20px] bg-white p-4 focus-visible:outline-2 focus-visible:outline-primary min-[360px]:p-5" aria-label={`연속 ${s.count}일, 내 기록 보기`}>
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
        <span className="ml-auto flex flex-none items-center self-start text-[14px] font-medium leading-[22px] text-primary">
          내 기록
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <WeekRow week={weekOf(stats, today)} />
    </Link>
  )
}

const MILESTONE: Record<number, string> = { 7: '일주일을 채웠어요', 30: '한 달을 채웠어요', 100: '100일을 채웠어요', 365: '1년을 채웠어요' }
// 터져 나오는 조각은 링클의 파랑 계열 위주에, 유사도 색을 조금 섞는다
const BIT_COLORS = ['#3366cc', '#8fb5f7', 'var(--color-s4)', '#5b8ae6', 'var(--color-s3)', '#c9dafb']
/** 불꽃 둘레에서 피어오르는 불티. [가로 위치(%), 늦춤(ms), 크기(px)] */
const SPARKS: [number, number, number][] = [
  [30, 0, 6], [62, 380, 5], [44, 760, 7], [70, 1140, 4], [36, 1520, 5], [56, 1900, 6], [25, 2280, 4], [66, 2660, 5],
]

/**
 * 연속 일수가 늘어난 직후 한 번 뜨는 화면. 짧은 애니메이션 한 편처럼 차례로 움직인다.
 *   0.0s  불꽃이 눌렸다 튀어 오르며 나타나고, 세 겹이 서로 다른 박자로 일렁이기 시작한다
 *   0.65s 파동 두 겹이 퍼지고 조각이 터지며, 숫자가 아래에서 위로 넘어간다
 *   0.65s 오늘 칸이 튀어 채워지고 체크가 그어지며 둘레로 빛이 번진다
 *   이후  불티가 계속 피어오른다
 * 겁주는 말은 쓰지 않는다. 끊겨도 알리지 않고, 이어 갔을 때만 축하한다.
 */
export function StreakCelebration({ stats, today, onDone }: { stats: Stats; today: string; onDone: () => void }) {
  const count = stats.streak
  const [shown, setShown] = useState(Math.max(count - 1, 0))
  useEffect(() => {
    const t = setTimeout(() => {
      setShown(count)
      // 불이 붙는 순간 짧게 떨린다(지원하는 휴대폰만)
      navigator.vibrate?.(18)
    }, 650)
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
          {/* 홈 카드의 불꽃 자리와 같은 평평한 옅은 원 */}
          {/* 옅은 파랑으로 채운 불꽃이 묻히지 않게 흰 원 위에 둔다 */}
          <span className="cel__glow absolute inset-[6%] rounded-full bg-white" />
          {shown === count && (
            <>
              <i className="cel__wave" aria-hidden />
              <i className="cel__wave cel__wave--late" aria-hidden />
              {bits.map((style, i) => (
                <i key={i} className="cel__bit" style={style} />
              ))}
            </>
          )}
          {SPARKS.map(([x, delay, size], i) => (
            <i key={i} className="cel__spark" style={{ left: `${x}%`, width: size, height: size, animationDelay: `${900 + delay}ms` }} aria-hidden />
          ))}
          <span className="cel__flame relative grid place-items-center">
            <Flame size={104} live ignite className="short:!h-16 short:!w-16" />
          </span>
        </div>
        {/* 숫자는 넘어가는 판처럼: 앞 숫자가 위로 빠지고 새 숫자가 아래에서 올라온다 */}
        <p className="cel__digits mt-2 text-[64px] font-extrabold leading-none tabular-nums text-flame short:mt-0 short:text-[52px]" aria-live="polite">
          {shown !== count || count === 0 ? (
            <span className="block">{shown}</span>
          ) : (
            <>
              {count > 1 && (
                <span className="cel__num-out" aria-hidden>
                  {count - 1}
                </span>
              )}
              <span className="cel__num block">{count}</span>
            </>
          )}
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

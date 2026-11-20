import type { ReactNode } from 'react'
import { ArrowRight, Flag, Lock, MousePointerClick, Undo2 } from 'lucide-react'
import { BACK_EMOJI, GOAL_EMOJI, LEVEL_EMOJI, nextKstMidnight } from '@linkle/core'
import { now } from '../game/store'
import { useTick } from './parts'

/** 짧은 값 여럿(예: "3번", "02:31")을 가운뎃점 없이 간격으로만 나눈다 */
export function Parts({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      {items.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </span>
  )
}

/** 흰 카드. 테두리와 그림자 없이 바탕과의 색 차이로만 구분한다 */
export function Card({ children, className = '', lift = false, ...rest }: { children: ReactNode; className?: string; lift?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={`rounded-[20px] bg-white p-4 min-[360px]:p-5 ${lift ? 'shadow-[0_10px_28px_-16px_rgb(51_102_204/0.35)]' : ''} ${className}`}>
      {children}
    </section>
  )
}

/** 주 버튼. 높이는 56 한 가지다 */
export function Cta({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`}>
      {children}
    </button>
  )
}

/** 보조 행동. 테두리와 바탕이 없는 글자 버튼 */
export function TextButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`press inline-flex h-12 items-center justify-center gap-1 rounded-full px-4 text-[16px] font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary ${className}`}>
      {children}
    </button>
  )
}

/** 출발 → 목표 두 칸. 시작 전에는 잠겨 있고, 시작하면 이름이 열린다 */
export function Route({ start, end }: { start?: string; end?: string }) {
  const slot = (title: string | undefined, hidden: string) =>
    title === undefined ? (
      <span className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#b8c9e6] text-[14px] text-ink-2">
        <Lock className="h-4 w-4 flex-none" strokeWidth={1.75} aria-hidden />
        {hidden}
      </span>
    ) : (
      <span className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-secondary px-3 text-[15px] font-semibold text-primary">
        <span className="truncate">{title}</span>
      </span>
    )
  return (
    <div className="flex items-center gap-2">
      {slot(start, '출발 문서')}
      <ArrowRight className="h-5 w-5 flex-none text-[#9db4dd]" strokeWidth={1.75} aria-hidden />
      {slot(end, '목표 문서')}
    </div>
  )
}

type Kind = 1 | 2 | 3 | 4 | 5 | 'back' | 'goal' | 'start' | 'unknown'
const SQ_BG: Record<string, string> = { 1: 'bg-s1', 2: 'bg-s2', 3: 'bg-s3', 4: 'bg-s4', 5: 'bg-s5', back: 'bg-[#c9d1da]', goal: 'bg-ink', unknown: 'bg-[#e9edf3]', start: 'shadow-[inset_0_0_0_1.5px_#b8c9e6]' }

/** 공유 문구의 이모지 한 글자가 화면의 어느 칸인지 */
export function kindOfEmoji(emoji: string): Kind {
  if (emoji === BACK_EMOJI) return 'back'
  if (emoji === GOAL_EMOJI) return 'goal'
  const level = (LEVEL_EMOJI as readonly string[]).indexOf(emoji)
  return level < 0 ? 'unknown' : ((level + 1) as Kind)
}

/** 유사도 칸. 운영체제마다 모양이 다른 이모지 대신 화면에서는 이것을 쓴다 */
export function Sq({ kind, size = 18 }: { kind: Kind; size?: number }) {
  const icon = Math.round(size * 0.62)
  return (
    <i className={`grid flex-none place-items-center text-white ${SQ_BG[kind]}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }} aria-hidden>
      {kind === 'back' && <Undo2 style={{ width: icon, height: icon }} strokeWidth={2.4} />}
      {kind === 'goal' && <Flag style={{ width: icon, height: icon }} strokeWidth={2.4} />}
    </i>
  )
}

/** 게임 방법 세 줄. 줄마다 그 규칙을 그린 작은 그림이 붙는다 */
export function HowTo() {
  const rows: [ReactNode, string, string][] = [
    [<MousePointerClick key="a" className="h-5 w-5" strokeWidth={1.75} aria-hidden />, '문서 속 링크만 눌러 이동해요', '파란 글자가 다음 문서로 가는 길이에요'],
    [<Flag key="b" className="h-5 w-5" strokeWidth={1.75} aria-hidden />, '목표 문서에 도착하면 끝나요', '이동 횟수와 시간이 기록돼요'],
    [
      <span key="c" className="grid grid-cols-2 gap-[3px]">
        <Sq kind={1} size={10} />
        <Sq kind={3} size={10} />
        <Sq kind={4} size={10} />
        <Sq kind={5} size={10} />
      </span>,
      '지나온 길이 색으로 남아요',
      '목표와 가까운 문서일수록 파랑이에요',
    ],
  ]
  return (
    <Card className="!py-2" aria-label="게임 방법">
      <ul>
        {rows.map(([art, title, desc], i) => (
          <li key={title} className={`flex items-center gap-3.5 py-3 ${i > 0 ? 'border-t border-[#eef1f5]' : ''}`}>
            <span className={`grid h-10 w-10 flex-none place-items-center rounded-full ${i === 1 ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>{art}</span>
            <span className="min-w-0">
              <b className="block text-[16px] font-semibold leading-[22px] text-ink">{title}</b>
              <span className="block text-[14px] leading-5 text-ink-2">{desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function hms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`
}

/** 다음 문제(한국 자정)까지 남은 시간 */
export function Countdown({ className = '' }: { className?: string }) {
  useTick(true)
  const t = now()
  return (
    <p className={`text-center text-[14px] leading-5 text-ink-2 ${className}`}>
      다음 링클까지 <b className="font-semibold tabular-nums text-ink">{hms(nextKstMidnight(t) - t)}</b>
    </p>
  )
}

/** "2026-11-19" → "11월 19일 목요일" */
export function formatDateKo(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${'일월화수목금토'[d.getUTCDay()]}요일`
}

/** 숫자 타일. 값이 아직 없으면 줄표를 둔다 */
export function StatTile({ label, value, unit, className = 'bg-white' }: { label: string; value: string | number | null; unit?: string; className?: string }) {
  return (
    <div className={`rounded-[14px] px-3 py-2.5 ${className}`}>
      <dt className="text-[13px] leading-[18px] text-ink-2">{label}</dt>
      <dd className="text-[20px] font-bold leading-7 tabular-nums text-primary">
        {value === null ? <span className="text-[#c5ccd6]">–</span> : value}
        {value !== null && unit && <span className="ml-px text-[14px] font-semibold">{unit}</span>}
      </dd>
    </div>
  )
}

/** 경로의 한 줄: 유사도 칸, 문서 제목, 오른쪽 짧은 설명 */
export function PathStep({ kind, title, note, strong, muted, href }: { kind: Parameters<typeof Sq>[0]['kind']; title: string; note?: string; strong?: boolean; muted?: boolean; href?: string }) {
  const cls = `min-w-0 truncate ${strong ? 'font-semibold text-primary' : 'font-medium'}`
  return (
    <li className={`flex h-9 items-center gap-3 text-[15px] ${muted ? 'text-ink-2' : 'text-ink'}`}>
      <Sq kind={kind} />
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} underline decoration-[#c9d3e0] underline-offset-[3px] hover:decoration-current`}>
          {title}
        </a>
      ) : (
        <span className={cls}>{title}</span>
      )}
      {note && <span className="ml-auto flex-none text-[13px] text-ink-2">{note}</span>}
    </li>
  )
}

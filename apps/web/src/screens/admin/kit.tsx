import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { ApiError } from '../../game/api'
import type { Difficulty, Hop } from '../../game/admin'
import { Card, TextButton } from '../../ui/cards'
import { Spinner } from '../../ui/parts'

// 관리자 화면의 탭들이 함께 쓰는 부품과 말. 시안: docs/design/admin-redesign

export type Notify = (message: string) => void

const ERRORS: Record<string, string> = {
  network: '서버에 닿지 못했어요',
  wrong_password: '비밀번호가 맞지 않아요',
  no_password: '서버에 관리자 비밀번호가 아직 없어요',
  already_open: '이미 열렸거나 누가 시작한 문제는 바꿀 수 없어요',
  no_change: '이미 반영돼 있어요',
  no_replacement: '대기열에 그날 낼 수 있는 문제가 없어서 그대로 뒀어요(최근 30일에 쓴 문서는 다시 못 써요)',
  unauthorized: '다시 들어와 주세요(로그인이 끝났어요)',
  no_token: 'Worker에 GITHUB_DISPATCH_TOKEN이 없어요',
  recent: '방금 불렀어요. 채우기가 도는 중이라 한 시간 뒤에 다시 누를 수 있어요',
}
export const messageOf = (e: unknown) => (e instanceof ApiError ? (ERRORS[e.code] ?? `처리하지 못했어요 (${e.code})`) : '처리하지 못했어요')

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? ''
export const monthDay = (date: string) => {
  const [, m, d] = date.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}
/** "12월 6일 일요일" */
export const longDate = (date: string) => `${monthDay(date)} ${weekdayOf(date)}요일`
export const kstTime = (at: number) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at)
export const kstDay = (at: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(at)

/** 받침에 따라 조사를 고른다. 한글로 끝나지 않으면 둘 다 적는다. topic("로마 제국") → "로마 제국은" */
function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return `${word}${withFinal}(${without})`
  return `${word}${(c - 0xac00) % 28 ? withFinal : without}`
}
export const topic = (word: string) => josa(word, '은', '는')
export const subject = (word: string) => josa(word, '이', '가')

/** 난이도 색. 유사도 칸의 초록·노랑·빨강과 같은 값이다 */
export const DIFF: [Difficulty, string, string][] = [
  ['easy', '쉬움', 'bg-s4'],
  ['normal', '보통', 'bg-s3'],
  ['hard', '어려움', 'bg-s1'],
]
export const diffLabel = (d: Difficulty | null) => DIFF.find(x => x[0] === d)?.[1] ?? '난이도 없음'

/** 줄마다 붙는 작은 단추. 모두 높이 36으로 같다 */
export function RowButton({ children, tone = 'plain', className = '', ...rest }: { tone?: 'plain' | 'danger' | 'solid' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const color = tone === 'danger' ? 'bg-[#fdeeed] text-[#c0392b]' : tone === 'solid' ? 'bg-primary text-white' : 'bg-secondary text-primary'
  return (
    <button {...rest} className={`press inline-flex h-9 flex-none items-center justify-center gap-1 rounded-full px-3.5 text-[14px] font-semibold disabled:opacity-40 ${color} ${className}`}>
      {children}
    </button>
  )
}

/**
 * 되돌리기 어려운 일은 두 번 눌러야 한다. 처음 누르면 빨갛게 바뀌고 4초 안에 다시 눌러야 한다.
 * 평소에는 옅은 파랑이다. 빨강은 확인 단계에서만 쓴다(시안 규칙 3)
 */
export function ConfirmButton({ children, confirm, onConfirm, disabled, className }: { children: ReactNode; confirm: string; onConfirm: () => void; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <RowButton tone={armed ? 'danger' : 'plain'} disabled={disabled} className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirm : children}
    </RowButton>
  )
}

export function Pair({ start, end, size = 'md' }: { start: string; end: string; size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <span className={`flex min-w-0 items-center text-ink ${lg ? 'gap-2 text-[22px] font-bold leading-[30px]' : 'gap-1.5 text-[16px] font-semibold leading-[22px]'}`}>
      <span className="truncate">{start}</span>
      <ArrowRight className={`flex-none text-[#b3bcc6] ${lg ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden />
      <span className="truncate">{end}</span>
    </span>
  )
}

export const hopsOf = (solution: string | null): Hop[] => {
  try {
    const v = solution ? (JSON.parse(solution) as unknown) : null
    return Array.isArray(v) ? (v as Hop[]) : []
  } catch {
    return []
  }
}

/** 정답 경로를 한 줄 글자로. 좁은 곳에서 쓴다 */
export function PathLine({ start, solution }: { start: string; solution: string | null }) {
  const hops = hopsOf(solution)
  if (!hops.length) return <span className="text-ink-2">정답 경로 없음</span>
  return <span className="truncate text-ink-2">{[start, ...hops.map(h => h.title)].join(' › ')}</span>
}

/** 정답 경로를 칩으로. 출발과 도착은 채운 칩, 사이 문서는 흰 칩. 누른 링크 이름이 문서 이름과 다르면(넘겨주기) 작게 덧붙인다 */
export function SolutionPath({ start, hops, count = true }: { start: string; hops: Hop[]; count?: boolean }) {
  if (!hops.length) return <p className="rounded-xl bg-[#f5f7fa] px-3 py-2.5 text-[14px] text-ink-2">정답 경로가 저장돼 있지 않아요</p>
  const steps = [{ title: start, via: start }, ...hops]
  return (
    <ol className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#f5f7fa] px-3 py-2.5 text-[14px]">
      {steps.map((h, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className={`rounded-lg px-2 py-0.5 font-semibold leading-6 ${i === 0 || i === steps.length - 1 ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
            {h.title}
            {h.via !== h.title && <span className="ml-1 text-[12px] font-medium opacity-70">({h.via})</span>}
          </span>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[#b3bcc6]" aria-hidden />}
        </li>
      ))}
      {count && <li className="ml-1 text-[13px] text-ink-2">{hops.length}번</li>}
    </ol>
  )
}

/**
 * 줄 맨 앞 날짜 꼬리표. 날짜("11.22", 굵은 15px로 44px)는 양옆에 10px씩 남도록 64px.
 * 아래 작은 글자는 요일이나 "오늘"이다
 */
export function DateBadge({ date, sub, on = false, small = false }: { date: string; sub: string; on?: boolean; small?: boolean }) {
  const [, m, d] = date.split('-')
  return (
    <span className={`grid flex-none place-items-center content-center gap-0.5 ${small ? 'h-11 w-14 rounded-xl' : 'h-12 w-16 rounded-[14px]'} ${on ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>
      <span className="text-[15px] font-bold leading-[18px] tabular-nums">
        {Number(m)}.{Number(d)}
      </span>
      <span className={`text-[11px] font-medium leading-3 ${on ? 'text-white/80' : 'text-ink-2'}`}>{sub}</span>
    </span>
  )
}

export function SectionHead({ title, count, aside }: { title: ReactNode; count?: number; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
      <h2 className="text-[17px] font-bold leading-[25px] text-ink">
        {title}
        {count !== undefined && <span className="ml-1.5 tabular-nums text-ink-2">{count}</span>}
      </h2>
      {aside}
    </div>
  )
}

/** 작은 알약 탭(필터). 큰 탭과 같은 모양을 작게 */
export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string, number?][]; onChange: (v: T) => void; label: string }) {
  return (
    // 좁은 화면에서 넘치면 옆으로 민다
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-[#e6ecf6] p-1 [scrollbar-width:none]">
      {options.map(([v, text, n]) => (
        <button
          key={v}
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className={`press flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold ${v === value ? 'bg-white text-primary shadow-[0_1px_2px_rgb(30_50_90/0.08)]' : 'text-ink-2'}`}
        >
          {text}
          {n !== undefined && <span className={`text-[13px] tabular-nums ${v === value ? 'text-primary' : 'text-ink-2'}`}>{n}</span>}
        </button>
      ))}
    </div>
  )
}

export function Loading() {
  return (
    <div className="grid h-48 place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="mt-2 text-center">
      <p className="text-[15px] text-ink">불러오지 못했어요</p>
      <TextButton onClick={onRetry} className="mt-1">
        다시 시도
      </TextButton>
    </Card>
  )
}

/** 넓은 화면(1024 이상)인지. 일정의 옆 패널과 아래 시트를 가른다 */
export function useWide(min = 1024): boolean {
  const query = `(min-width: ${min}px)`
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return wide
}

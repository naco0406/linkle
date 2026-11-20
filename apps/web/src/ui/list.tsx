import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

/** 목록 화면의 틀: 왼쪽 정렬 제목과 한 줄 설명. 홈과 같은 폭(440)으로 가운데에 둔다 */
export function ListPage({ title, desc, children }: { title: string; desc: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="pb-4 pt-5">
        <h1 className="text-[22px] font-bold leading-[31px] text-ink">{title}</h1>
        <p className="mt-0.5 text-[15px] leading-[22px] text-ink-2">{desc}</p>
      </header>
      {children}
    </main>
  )
}

/** 카드 안의 한 줄. 왼쪽 그림, 제목과 설명 두 줄, 오른쪽 값이나 화살표 */
export function ListRow({ to, lead, title, sub, trail }: { to: string; lead: ReactNode; title: ReactNode; sub: ReactNode; trail?: ReactNode }) {
  return (
    <li className="border-t border-[#eef1f5] first:border-t-0">
      <Link to={to} className="press -mx-2 flex min-h-[68px] items-center gap-3 rounded-xl px-2 py-2.5 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="flex-none">{lead}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-[22px] text-ink">{title}</span>
          <span className="block truncate text-[14px] leading-5 text-ink-2">{sub}</span>
        </span>
        <span className="flex flex-none items-center gap-1 text-[14px] font-semibold tabular-nums text-primary">
          {trail}
          <ChevronRight className="h-[18px] w-[18px] text-[#b3bcc6]" aria-hidden />
        </span>
      </Link>
    </li>
  )
}

/** 정사각 꼬리표: 날짜나 번호 */
export function Badge({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <span className="grid h-11 w-11 place-items-center content-center rounded-[14px] bg-secondary text-primary">
      <span className="text-[17px] font-bold leading-5 tabular-nums">{top}</span>
      {bottom && <span className="text-[11px] font-medium leading-3 text-ink-2">{bottom}</span>}
    </span>
  )
}

/** 정렬 고르기. 고른 칸에 흰 알약이 놓인다(아래 탭과 같은 모양) */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-3 grid rounded-full bg-[#e6ecf6] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, text]) => (
        <button
          key={v}
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className={`press h-9 rounded-full text-[14px] font-semibold transition-colors ${v === value ? 'bg-white text-primary shadow-[0_1px_2px_rgb(30_50_90/0.08)]' : 'text-ink-2'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const DIFF: Record<string, [string, string]> = {
  easy: ['쉬움', 'bg-[#e7f4e8] text-[#2f7d38]'],
  normal: ['보통', 'bg-[#fdf3d8] text-[#9a6a00]'],
  hard: ['어려움', 'bg-[#fde7e6] text-[#c0392b]'],
}

/** 예상 난이도 꼬리표 */
export function DifficultyChip({ value }: { value: string | null }) {
  const d = value ? DIFF[value] : undefined
  if (!d) return null
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[12px] font-semibold ${d[1]}`}>{d[0]}</span>
}

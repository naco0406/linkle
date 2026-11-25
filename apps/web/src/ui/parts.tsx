import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

/** "이름: 값" 한 쌍. 값은 브랜드 색으로 강조한다 */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-ink">
      {label}: <span className="font-semibold text-primary tabular-nums">{children}</span>
    </span>
  )
}

/** 출발 → … → 도착. 양 끝만 강조한다 */
export function PathTrail({ titles, className = '' }: { titles: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-y-1 ${className}`}>
      {titles.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="mx-2 shrink-0 text-ink/60">→</span>}
          <span className={i === 0 || i === titles.length - 1 ? 'font-semibold text-primary' : 'text-ink'}>{t}</span>
        </Fragment>
      ))}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-primary ${className}`} aria-hidden />
}

export function PrimaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex h-14 items-center justify-center rounded-full bg-primary px-20 text-lg font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-full w-full max-w-md overflow-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-ink hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="게임 방법" onClose={onClose}>
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
        <li>출발 문서에서 시작해, 문서 안의 링크만 눌러 <b className="text-primary">목표 문서</b>에 도착하세요.</li>
        <li>매일 자정에 모두에게 같은 문제가 나옵니다. 하루에 한 번 도전할 수 있습니다.</li>
        <li>시작을 누르면 시간이 흐르기 시작하고, 나갔다 들어와도 계속 흐릅니다.</li>
        <li>뒤로가기도 이동 횟수에 들어갑니다.</li>
        <li>페이지 검색을 써도 게임은 이어지지만, 그 판은 어제의 기록과 순위표에서 빠집니다.</li>
        <li>
          결과를 공유하면 지나온 문서가 목표와 얼마나 가까웠는지가 색으로 나타납니다.
          <div className="mt-1">🟥 🟧 🟨 🟩 🟦 순서로 가깝고, 뒤로가기는 ⏪, 도착은 🏁입니다.</div>
        </li>
      </ul>
    </Modal>
  )
}

/** 잠깐 떴다 사라지는 안내 */
export function Toast({ message, onDone, ms = 3500 }: { message: string; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms)
    return () => clearTimeout(t)
  }, [message, ms, onDone])
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center px-4">
      <div className="rounded-full bg-ink px-5 py-2.5 text-sm text-white shadow-lg">{message}</div>
    </div>
  )
}

/** 1초마다 다시 그리게 한다. 값 자체는 저장하지 않는다 */
export function useTick(active: boolean): void {
  const [, set] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => set(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])
}

import type { LucideIcon } from 'lucide-react'

/** 아직 만들지 않은 화면의 자리. 탭이 가리키는 곳이 비어 있지 않게 한다 */
export function Soon({ title, body, icon: Icon }: { title: string; body: string; icon: LucideIcon }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-primary">
        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="max-w-xs text-[15px] leading-relaxed text-ink-2">{body}</p>
    </main>
  )
}

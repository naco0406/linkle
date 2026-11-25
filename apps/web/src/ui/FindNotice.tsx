import { useEffect } from 'react'
import { Search } from 'lucide-react'

/** 페이지 검색 단축키를 처음 눌렀을 때, 다시 누르면 검색이 열리는 시간 */
export const FIND_WINDOW_MS = 4000

/** 검색 단축키의 이름. 맥 계열은 ⌘, 나머지는 Ctrl */
export const FIND_MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'

/**
 * 페이지 검색을 쓰기 전에 한 번 묻는다(설계 문서 5.2). 검색을 막지는 않는다: 단축키를 한 번 더 누르면 열린다.
 * 아래 막대가 다시 누를 수 있는 남은 시간이다.
 */
export function FindNotice({ stake, onDone }: { stake: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, FIND_WINDOW_MS)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="w-full max-w-[400px] animate-[rise_0.18s_ease-out] overflow-hidden rounded-[18px] bg-ink text-white">
        <div className="flex items-start gap-3 py-3.5 pl-3.5 pr-4">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/[0.14]">
            <Search className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pt-px">
            <p className="text-[15px] font-semibold leading-[22px] [text-wrap:balance]">페이지 검색을 쓰면 {stake}에서 빠져요</p>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] leading-6 text-white/75">
              그래도 찾으려면
              <span className="flex gap-1" aria-label={`${FIND_MOD} F`}>
                <Key>{FIND_MOD}</Key>
                <Key>F</Key>
              </span>
              한 번 더
            </p>
          </div>
        </div>
        <div className="h-[3px] bg-white/10">
          <div className="h-full origin-left animate-[drain_4s_linear_forwards] bg-white/60" />
        </div>
      </div>
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd aria-hidden className="inline-grid h-6 min-w-7 place-items-center rounded-md bg-white/[0.14] px-2 font-sans text-[13px] font-semibold leading-none text-white">
      {children}
    </kbd>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CircleHelp } from 'lucide-react'
import { backTarget, currentPage, elapsedMs, formatClock, moveCount, pathOf, type Run } from '@linkle/core'
import { getModel } from '../game/emoji'
import { now, useGame } from '../game/store'
import { useNavigator } from '../game/useNavigator'
import { Help, PathTrail, Spinner, Stat, Toast, useTick } from '../ui/parts'
import { WikiView } from '../ui/WikiView'

/**
 * 게임 화면. Header와 Footer는 스크롤 영역 밖에 있어 어떤 상황에서도 함께 보인다.
 * 화면 높이는 dvh로 잡아 모바일 브라우저의 주소창이 접히고 펴져도 맞는다.
 */
export function Game({ run }: { run: Run }) {
  const { page, busy, error, go, back, retry, dismissError } = useNavigator(run)
  const [help, setHelp] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const prev = backTarget(run)
  const here = currentPage(run)
  useTick(true)

  // 유사도 모델을 미리 받아 둔다. 도착했을 때 기다리지 않게 하려는 것이다
  useEffect(() => {
    void getModel().catch(() => {})
  }, [])

  // 새 문서는 맨 위부터 보여 준다
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [page?.id])

  // 페이지 내 검색은 막지 않고 표시만 남긴다. 통계 후보에서만 빠진다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') useGame.getState().flag('find')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-line bg-secondary px-2 sm:h-20 sm:px-4">
        <button onClick={back} disabled={!prev || busy} aria-label="이전 문서로" className="flex min-w-0 items-center gap-2.5 rounded-lg p-2 text-ink disabled:opacity-35">
          <ArrowLeft className="h-6 w-6 shrink-0" />
          <span className="hidden max-w-48 truncate sm:inline">{prev?.title ?? ''}</span>
        </button>
        <div className="min-w-0 truncate text-ink">
          목표: <span className="hidden font-semibold text-primary sm:inline">{run.puzzle.start.title}</span>
          <span className="hidden sm:inline"> → </span>
          <span className="font-semibold text-primary">{run.puzzle.end.title}</span>
        </div>
        <button onClick={() => setHelp(true)} aria-label="게임 방법" className="rounded-lg p-2 text-ink">
          <CircleHelp className="h-6 w-6" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {busy && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary" />}
        <div ref={scroller} className={`h-full overflow-auto overscroll-contain px-4 py-4 transition-opacity ${busy && page ? 'pointer-events-none opacity-50' : ''}`}>
          {page ? (
            <div className="mx-auto max-w-4xl">
              <WikiView page={page} onNavigate={go} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4">
              {error ? (
                <>
                  <p className="mb-6 text-ink">{error}</p>
                  <button onClick={retry} className="rounded-full border border-primary px-6 py-2 text-primary">
                    다시 시도
                  </button>
                </>
              ) : (
                <>
                  <Spinner className="mb-10 h-12 w-12" />
                  <p className="mb-16 text-ink">로딩 중</p>
                </>
              )}
              <PathTrail titles={pathOf(run).map(s => s.page.title)} className="mt-6 max-w-3xl" />
            </div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col gap-2 border-t border-line bg-secondary px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 truncate text-ink">
          현재 문서: <span className="font-semibold text-primary">{here.title}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Stat label="소요 시간">{formatClock(elapsedMs(run, now()))}</Stat>
          <Stat label="이동 횟수">{moveCount(run)}</Stat>
        </div>
      </footer>

      {help && <Help onClose={() => setHelp(false)} />}
      {error && page && <Toast message={error} onDone={dismissError} />}
    </div>
  )
}

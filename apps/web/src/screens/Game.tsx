import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, CircleHelp, Flag, Footprints, Timer, Undo2, X } from 'lucide-react'
import { backTarget, elapsedMs, formatClock, moveCount, pathOf, stackOf, type Run } from '@linkle/core'
import { getModel } from '../game/emoji'
import { now, useGame, type Slot } from '../game/store'
import { useNavigator } from '../game/useNavigator'
import { Help, PathTrail, Spinner, Toast, useTick } from '../ui/parts'
import { WikiView } from '../ui/WikiView'
import { CC_BY_SA } from '../ui/license'

const TRAIL = 'items-center gap-1 overflow-x-auto whitespace-nowrap text-[14px] [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,#000_24px)]'

/**
 * 게임 화면. 위에서부터 목표, 지나온 길, 문서, 그리고 되돌아가기와 숫자.
 * 문서만 스크롤되고 나머지는 늘 보인다. 화면 높이는 dvh로 잡아 모바일 브라우저의 주소창이 접히고 펴져도 맞는다.
 */
export function Game({ run, slot = 'daily', onQuit, quitLabel = '그만두기', top, onMove }: { run: Run; slot?: Slot; onQuit?: () => void; quitLabel?: string; top?: ReactNode; onMove?: (run: Run) => void }) {
  const { page, busy, opening, error, go, back, retry, dismissError } = useNavigator(run, slot)
  const [help, setHelp] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const trail = useRef<HTMLDivElement>(null)
  const trailShort = useRef<HTMLDivElement>(null)
  const prev = backTarget(run)
  const stack = stackOf(run.puzzle.start, run.events)
  useTick(true)
  // 지나온 길. 누를 수는 없다: 이동은 문서 속 링크와 되돌아가기뿐이다
  const crumbs = stack.map((p, i) => (
    <Fragment key={`${i}-${p.id}`}>
      {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-none text-[#b3bcc6]" aria-hidden />}
      <span className={i === stack.length - 1 ? 'rounded-lg bg-secondary px-2 py-0.5 font-semibold text-primary short:bg-white' : 'text-ink-2'}>{p.title}</span>
    </Fragment>
  ))

  // 유사도 모델을 미리 받아 둔다. 도착했을 때 기다리지 않게 하려는 것이다
  useEffect(() => {
    void getModel().catch(() => {})
  }, [])

  // 같이 달리기는 이동할 때마다 방에 알린다
  const moved = useRef(run.events.length)
  useEffect(() => {
    if (run.events.length !== moved.current) {
      moved.current = run.events.length
      onMove?.(run)
    }
  }, [run, onMove])

  // 새 문서는 맨 위부터 보여 주고, 경로 띠는 지금 문서가 보이게 끝으로 민다
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
    for (const el of [trail.current, trailShort.current]) el?.scrollTo({ left: el.scrollWidth })
  }, [page?.id, stack.length])

  // 페이지 내 검색은 막지 않고 표시만 남긴다. 통계 후보에서만 빠진다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') useGame.getState().flag(slot, 'find')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slot])

  return (
    <div className="flex h-dvh flex-col bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="flex h-14 flex-none items-center gap-2.5 border-b border-line bg-secondary pl-4 pr-2 short:h-12">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-primary text-white">
          <Flag className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <p className="flex min-w-0 flex-1 items-baseline gap-2 short:max-w-[40%] short:flex-initial">
          <span className="flex-none text-[13px] leading-4 text-ink-2">목표</span>
          <b className="truncate text-[17px] font-semibold leading-6 text-primary">{run.puzzle.end.title}</b>
        </p>
        {/* 눕힌 화면은 세로가 모자라서 지나온 길을 머리 안으로 들인다 */}
        <div ref={trailShort} className={`${TRAIL} hidden min-w-0 flex-1 pl-4 short:flex`} aria-label="지나온 길">
          {crumbs}
        </div>
        <button onClick={() => setHelp(true)} aria-label="게임 방법" className="press grid h-10 w-10 flex-none place-items-center rounded-full text-ink">
          <CircleHelp className="h-6 w-6" strokeWidth={1.75} />
        </button>
        {/* 관리자 연습 판에만 있다. 오늘의 문제는 그만둘 수 없다 */}
        {onQuit && (
          <button onClick={onQuit} aria-label={quitLabel} className="press -ml-2 grid h-10 w-10 flex-none place-items-center rounded-full text-ink">
            <X className="h-6 w-6" strokeWidth={1.75} />
          </button>
        )}
      </header>

      {/* 도전장의 고스트 줄, 같이 달리기의 레이스 바(설계 문서 16장). 머리와 지나온 길 사이 한 줄 */}
      {top}

      {/* 세로 화면에서는 지나온 길이 머리 아래에 한 줄을 차지한다 */}
      <div ref={trail} className={`${TRAIL} flex h-11 flex-none border-b border-line bg-white px-4 short:hidden`} aria-label="지나온 길">
        {crumbs}
      </div>

      <div className="relative min-h-0 flex-1">
        {busy && <div className="absolute inset-x-0 top-0 z-10 h-[3px] animate-pulse bg-primary" />}
        <div ref={scroller} className={`h-full overflow-auto overscroll-contain px-4 py-4 transition-opacity ${busy && page ? 'pointer-events-none opacity-45' : ''}`}>
          {page ? (
            <div className="mx-auto max-w-4xl">
              <WikiView page={page} onNavigate={go} />
              {/* 위키백과 글은 CC BY-SA 4.0이다. 원문 링크는 게임 밖으로 새지 않게 도착한 뒤에 준다 */}
              <p className="mt-8 border-t border-line pb-2 pt-3 text-[12px] leading-[18px] text-ink-2">
                이 문서는 한국어 위키백과의 「{page.title}」 문서를 가져와 각주와 탐색 상자 등을 뺀 것이에요. 글은{' '}
                <a href={CC_BY_SA.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {CC_BY_SA.name}
                </a>{' '}
                라이선스를 따르며, 원문과 기여자는 도착한 뒤 볼 수 있어요.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4">
              {error ? (
                <>
                  <p className="mb-6 text-ink">{error}</p>
                  <button onClick={retry} className="press h-12 rounded-full bg-secondary px-6 font-medium text-primary">
                    다시 시도
                  </button>
                </>
              ) : (
                <>
                  <Spinner className="mb-10 h-12 w-12" />
                  <p className="mb-16 text-ink">문서를 여는 중</p>
                </>
              )}
              <PathTrail titles={pathOf(run).map(s => s.page.title)} className="mt-6 max-w-3xl" />
            </div>
          )}
        </div>
        {/* 무엇을 여는 중인지 말해 준다. 잘못 눌렀는지 바로 알 수 있다 */}
        {busy && opening && page && (
          <p role="status" className="absolute bottom-4 left-1/2 z-10 flex h-10 max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 text-[14px] text-white">
            <Spinner className="h-3.5 w-3.5 flex-none text-white" />
            <b className="truncate font-semibold">{opening}</b>
            <span className="flex-none">여는 중</span>
          </p>
        )}
      </div>

      <footer className="flex h-16 short:h-13 flex-none items-center justify-between gap-3 border-t border-line bg-secondary pl-3 pr-4 pb-[env(safe-area-inset-bottom)] [box-sizing:content-box]">
        <button onClick={back} disabled={!prev || busy} aria-label={prev ? `${prev.title} 문서로 되돌아가기` : '되돌아갈 문서가 없어요'} className="press flex h-11 min-w-0 max-w-[55%] items-center gap-2 rounded-full bg-white pl-3 pr-4 text-[15px] text-ink disabled:opacity-40">
          <Undo2 className="h-5 w-5 flex-none" strokeWidth={1.75} aria-hidden />
          <b className="truncate font-semibold">{prev?.title ?? '출발 문서'}</b>
        </button>
        <dl className="flex flex-none items-center gap-4 text-[16px] font-semibold tabular-nums text-primary">
          <div className="flex items-center gap-1.5">
            <dt>
              <Timer className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.75} aria-label="소요 시간" />
            </dt>
            <dd>{formatClock(elapsedMs(run, now()))}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>
              <Footprints className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.75} aria-label="이동 횟수" />
            </dt>
            <dd>{moveCount(run)}</dd>
          </div>
        </dl>
      </footer>

      {help && <Help onClose={() => setHelp(false)} />}
      {error && page && <Toast message={error} onDone={dismissError} />}
    </div>
  )
}

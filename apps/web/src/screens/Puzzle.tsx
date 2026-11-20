import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { createRun, elapsedMs, formatClock, moveCount } from '@linkle/core'
import { getDay, getPuzzle, startPuzzle, type PuzzleInfo } from '../game/api'
import { runIn, useGame, useImmersive } from '../game/store'
import { useLoad } from '../game/useLoad'
import { BoardCard } from '../ui/Board'
import { Card, Cta, formatDateKo, Route, StatTile, TextButton } from '../ui/cards'
import { DifficultyChip } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { useMyDayResult } from './Archive'
import { Arrival } from './Arrival'
import { Game } from './Game'
import { DayStats, Notice, Skeleton } from './Yesterday'

type Kind = 'archive' | 'community'

/**
 * 지난 문제와 커뮤니티 문제 한 판의 화면. 주소는 어떤 문제인지만 정하고, 무엇을 보일지는 판의 상태가 정한다(설계 문서 3.5).
 *   시작 전·다시 풀기 전  문제 카드
 *   푸는 중             게임 화면
 *   막 도착함            도착 화면 (지난 문제는 그날의 기록, 커뮤니티는 순위표가 아래에 붙는다)
 */
export function PuzzlePage({ kind }: { kind: Kind }) {
  const id = Number(useParams().id)
  const run = useGame(s => runIn(s, id))
  const seen = useGame(s => s.seen)
  const setImmersive = useImmersive(s => s.set)
  const fresh = run?.phase === 'finished' && !seen.includes(run.runId)
  const immersive = run?.phase === 'playing' || fresh
  const { data: info, error } = useLoad(`puzzle:${id}`, () => getPuzzle(id))

  useEffect(() => {
    setImmersive(!!immersive)
    return () => setImmersive(false)
  }, [immersive, setImmersive])

  if (!Number.isInteger(id) || id <= 0 || (error && !run)) return <Missing kind={kind} />
  if (run?.phase === 'playing') return <Game run={run} slot={id} />
  if (run && fresh) {
    return (
      <Arrival
        run={run}
        third={kind === 'community' ? { label: '순위', value: run.result?.rank ?? null, unit: '위' } : { label: '기록', value: '연습' }}
        closeLabel="문제로 돌아가기"
      >
        {kind === 'community' ? <BoardCard puzzleId={id} refresh={String(run.result?.rank ?? '')} /> : run.puzzle.date && <DayCompare date={run.puzzle.date} />}
      </Arrival>
    )
  }
  if (!info) return <Frame kind={kind}>{error ? <Missing kind={kind} /> : <Skeleton />}</Frame>
  return <Intro kind={kind} info={info} />
}

function Frame({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to={`/${kind}`} className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          {kind === 'archive' ? '지난 문제' : '커뮤니티'}
        </Link>
      </header>
      {children}
    </main>
  )
}

function Missing({ kind }: { kind: Kind }) {
  return (
    <Frame kind={kind}>
      <Notice title="문제를 찾을 수 없어요" body="주소가 바뀌었거나 아직 열리지 않은 문제예요." />
    </Frame>
  )
}

function Intro({ kind, info }: { kind: Kind; info: PuzzleInfo }) {
  const id = info.id
  const run = useGame(s => runIn(s, id))
  const mine = useMyDayResult()({ id, date: info.date })
  const done = run?.phase === 'finished' ? run : null
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const start = async () => {
    setStarting(true)
    try {
      const s = await startPuzzle(id)
      useGame.getState().begin(id, createRun({ mode: s.mode, puzzle: s.puzzle, runId: s.runId, startedAt: s.startedAt }), s.serverNow)
    } catch {
      setToast('시작하지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setStarting(false)
    }
  }

  const archive = kind === 'archive'
  const played = !!done || !!mine
  const title = archive && info.date ? `#${info.number} · ${formatDateKo(info.date)}` : `링클 커뮤니티 #${info.number}`
  const rate = info.plays === 0 ? null : `${Math.round((info.clears / info.plays) * 100)}`

  return (
    <Frame kind={kind}>
      <Card lift aria-label="문제">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold leading-[22px] text-primary">{archive ? '지난 문제' : info.kind === 'official' ? '링클이 낸 문제' : `${info.author}님의 문제`}</span>
          <DifficultyChip value={info.difficulty} />
        </div>
        <p className="mt-0.5 text-[22px] font-bold leading-[31px] text-ink">{title}</p>
        <div className="mt-4">{done ? <Route start={done.puzzle.start.title} end={done.puzzle.end.title} /> : <Route />}</div>

        {mine && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-[15px] leading-[22px] text-ink">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            <span>
              나는 <b className="font-semibold tabular-nums text-primary">{mine.moves}번 · {formatClock(mine.ms)}</b>
              {!archive && done?.result?.rank ? ` · ${done.result.rank}위` : ''}
            </span>
          </p>
        )}

        <dl className="mb-4 mt-3 grid grid-cols-3 gap-2">
          <StatTile className="bg-secondary" label={archive ? '그날 도착' : '도전'} value={(archive ? info.clears : info.plays).toLocaleString('ko-KR')} unit="명" />
          <StatTile className="bg-secondary" label="클리어율" value={rate} unit="%" />
          <StatTile className="bg-secondary" label="가운데" value={info.medianMoves} unit="번" />
        </dl>

        <Cta onClick={start} disabled={starting}>
          {starting ? <Spinner className="h-6 w-6 text-white" /> : played ? '다시 풀기' : '시작'}
        </Cta>
        <p className="mt-2 text-center text-[13px] leading-5 text-ink-2">
          {archive
            ? '연속 기록과 순위에는 들어가지 않아요'
            : played
              ? '다시 풀면 순위에는 들지 않아요'
              : '누르면 두 문서가 공개되고 시간이 흘러요. 처음 도전한 기록만 순위에 올라요'}
        </p>
        {done && (
          <TextButton onClick={() => useGame.getState().showArrival(done.runId, true)} className="mx-auto mt-1 flex">
            지난 결과 다시 보기 · {moveCount(done)}번 {formatClock(elapsedMs(done, done.finishedAt ?? done.startedAt))}
          </TextButton>
        )}
      </Card>

      <div className="mt-3 flex flex-col gap-3">
        {!archive && <BoardCard puzzleId={id} refresh={String(done?.result?.rank ?? '')} />}
        {/* 그날의 기록에는 출발·도착과 가장 짧은 길이 있다. 풀어 본 사람에게만 보인다 */}
        {archive && played && info.date && <DayCompare date={info.date} />}
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </Frame>
  )
}

/** 지난 문제를 푼 뒤 그날 사람들의 기록과 나란히 본다 */
function DayCompare({ date }: { date: string }) {
  const { data } = useLoad(`day:${date}`, () => getDay(date))
  if (!data) return <Skeleton />
  if (data.status !== 'ready') return null
  return (
    <>
      <h2 className="mt-2 px-1 text-[17px] font-bold leading-[25px] text-ink">그날 사람들의 기록</h2>
      <DayStats stats={data} />
    </>
  )
}

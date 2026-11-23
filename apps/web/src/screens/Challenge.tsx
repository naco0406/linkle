import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Lock, ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { createRun, formatClock, puzzleName } from '@linkle/core'
import { getChallenge, startPuzzle, type Challenge as ChallengeData } from '../game/api'
import { remember } from '../game/inbox'
import { runIn, useGame, useImmersive } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, TextButton } from '../ui/cards'
import { DifficultyChip } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { Ava, ChallengeBoard, EmojiSq, GhostBar, TwoPaths, VsCards } from '../ui/Friends'
import { Arrival } from './Arrival'
import { Game } from './Game'
import { CardTitle, Notice, Skeleton } from './Yesterday'

/**
 * 도전장(/c/:code, 설계 문서 16.2). 받은 사람이 보는 카드 → 고스트와 함께 풀기 → 나란히 견주기.
 * 출발·도착은 시작을 누르기 전까지 잠겨 있다. 판은 그 문제의 자리(문제 id)에 놓인다.
 */
export function ChallengePage() {
  const code = (useParams().code ?? '').toUpperCase()
  const { data, error, reload } = useLoad(`challenge:${code}`, () => getChallenge(code))
  const run = useGame(s => (data ? runIn(s, data.puzzle.id) : null))
  const seen = useGame(s => s.seen)
  const setImmersive = useImmersive(s => s.set)
  const mine = run && run.challenge === code ? run : null
  const fresh = mine?.phase === 'finished' && !seen.includes(mine.runId)
  const immersive = mine?.phase === 'playing' || fresh

  useEffect(() => {
    setImmersive(!!immersive)
    return () => setImmersive(false)
  }, [immersive, setImmersive])

  // 열어 본 도전장은 커뮤니티의 "받은 도전장"에 남긴다
  useEffect(() => {
    if (data) remember({ code, puzzleId: data.puzzle.id, name: data.sender.name, kind: data.puzzle.kind, number: data.puzzle.number, ms: data.sender.ms, moves: data.sender.moves, at: Date.now() })
  }, [data, code])

  if (mine?.phase === 'playing') return <Game run={mine} slot={mine.puzzle.id} top={mine.ghost ? <GhostBar ghost={mine.ghost} startedAt={mine.startedAt} /> : undefined} />
  if (mine && fresh) return <Arrival run={mine} third={{ label: '순위', value: mine.result?.rank ?? null, unit: '위' }} closeLabel="도전장으로 돌아가기" />
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to="/community" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          커뮤니티
        </Link>
      </header>
      {!data ? (
        error ? (
          <Notice title="도전장을 찾을 수 없어요" body="주소가 틀렸거나 문제가 내려갔어요.">
            <TextButton onClick={reload} className="-ml-4 mt-2">
              다시 불러오기
            </TextButton>
          </Notice>
        ) : (
          <Skeleton />
        )
      ) : (
        <Body data={data} reload={reload} />
      )}
    </main>
  )
}

function Body({ data, reload }: { data: ChallengeData; reload: () => void }) {
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const short = data.sender.name.split(' ').slice(-2, -1)[0] ?? data.sender.name
  const finishedHere = useGame(s => {
    const r = runIn(s, data.puzzle.id)
    return r?.phase === 'finished' && r.challenge === data.code ? r : null
  })

  const start = async () => {
    setStarting(true)
    try {
      const s = await startPuzzle(data.puzzle.id, data.code)
      const run = { ...createRun({ mode: s.mode, puzzle: s.puzzle, runId: s.runId, startedAt: s.startedAt }), ...(s.ghost ? { challenge: data.code, ghost: s.ghost } : {}) }
      useGame.getState().begin(data.puzzle.id, run, s.serverNow)
    } catch {
      setToast('시작하지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setStarting(false)
    }
  }

  return (
    <>
      <Card lift aria-label="도전장">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold leading-[22px] text-primary">도전장</span>
          <DifficultyChip value={data.puzzle.difficulty} />
          <span className="ml-auto text-[14px] text-ink-2">{puzzleName(data.puzzle).replace('Linkle ', '')}</span>
        </div>
        <p className="mt-0.5 text-[22px] font-bold leading-[31px] text-ink">
          {data.sender.name}님이
          <br />
          도전장을 보냈어요
        </p>
        {!data.compare && (
          <div className="mt-4 flex items-center gap-2">
            {['출발 문서', '목표 문서'].map((t, i) => (
              <span key={t} className="contents">
                {i > 0 && <ArrowRight className="h-5 w-5 flex-none text-[#9db4dd]" strokeWidth={1.75} aria-hidden />}
                <span className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#b8c9e6] text-[14px] text-ink-2">
                  <Lock className="h-4 w-4 flex-none" strokeWidth={1.75} aria-hidden />
                  {t}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-secondary px-3.5 py-2.5 text-[14px] leading-[21px] text-ink">
          <Ava name={data.sender.name} size={24} />
          <span className="min-w-0 flex-1">
            {short}님은 <b className="font-semibold tabular-nums text-primary">{data.sender.moves}번</b>, <b className="font-semibold tabular-nums text-primary">{formatClock(data.sender.ms)}</b> 만에 도착
          </span>
          <span className="flex flex-none gap-[3px]">{data.sender.emoji?.map((e, i) => <EmojiSq key={i} emoji={e} />)}</span>
        </div>
        {data.byAuthor && <p className="mt-2 text-[13px] leading-5 text-ink-2">{short}님이 낸 문제예요. 길을 알고 풀었으니 이동 수로 겨뤄 보세요.</p>}
        <div className="mt-4">
          <Cta onClick={start} disabled={starting}>
            {starting ? <Spinner className="h-6 w-6 text-white" /> : data.compare ? '다시 풀기' : '도전하기'}
          </Cta>
        </div>
        <p className="mt-2 text-center text-[13px] leading-5 text-ink-2">
          {data.compare ? '다시 풀면 순위에는 처음 기록이 남아요' : `누르면 두 문서가 공개되고 시간이 흘러요. ${short}님의 진행이 위에 함께 보여요`}
        </p>
        {finishedHere && (
          <TextButton onClick={() => useGame.getState().showArrival(finishedHere.runId, true)} className="mx-auto mt-1 !flex w-fit">
            지난 결과 다시 보기
          </TextButton>
        )}
      </Card>

      {data.compare && (
        <div className="mt-3 flex flex-col gap-3">
          <VsCards me={data.compare.mine} them={data.sender} byMoves={data.byAuthor} />
          <Card className="!p-4">
            <TwoPaths mine={data.compare.mine.path} theirs={data.compare.theirs.path} />
          </Card>
        </div>
      )}

      <Card className="mt-3" aria-label="이 도전장 순위">
        <CardTitle side={`${data.board.length}명`}>이 도전장 순위</CardTitle>
        <ChallengeBoard data={data} />
        <TextButton onClick={reload} className="-mb-2 -ml-4 mt-1">
          새로 보기
        </TextButton>
      </Card>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}

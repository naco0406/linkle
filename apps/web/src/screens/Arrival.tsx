import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Flag, Send, Share2 } from 'lucide-react'
import { elapsedMs, formatClock, kstDate, moveCount, type Run } from '@linkle/core'
import { useStats } from '../game/stats'
import { now, useGame } from '../game/store'
import { useEmoji } from '../game/useEmoji'
import { CC_BY_SA, wikiUrl } from '../ui/license'
import { Card, Countdown, Cta, formatDateKo, kindOfEmoji, PathStep as Step, Sq, StatTile as Tile, TextButton } from '../ui/cards'
import { Spinner, Toast } from '../ui/parts'
import { shareRun } from '../ui/share'
import { StreakCelebration } from '../ui/Streak'
import { getChallenge } from '../game/api'
import { useLoad } from '../game/useLoad'
import { ADMIN_RUN_PREFIX } from '../game/admin'
import { ChallengeBoard, sendChallenge, TwoPaths, VsCards } from '../ui/Friends'
import { CardTitle } from './Yesterday'

type TileValue = { label: string; value: string | number | null; unit?: string }

/**
 * 도착 화면. 목표에 닿은 직후 한 번 뜨고, 아래 글자 버튼을 누르면 닫힌다.
 * 숫자 셋을 타일로, 지나온 길을 문서마다 색이 붙은 목록으로 보여 준다.
 * 오늘의 문제, 지난 문제, 커뮤니티 문제가 함께 쓴다. 다른 것은 세 번째 타일, 닫는 곳, 아래에 덧붙는 카드다.
 */
export function Arrival({
  run,
  third,
  closeLabel = '홈으로',
  onClose,
  children,
}: {
  run: Run
  third?: TileValue
  closeLabel?: string
  onClose?: () => void
  children?: ReactNode
}) {
  useEmoji(run)
  // 앞 화면의 스크롤 위치를 물려받지 않고 맨 위에서 연다
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [run.runId])
  const stats = useStats(s => s.stats)
  const celebrate = useStats(s => s.celebrate)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const { puzzle } = run
  const kinds = run.emoji?.map(kindOfEmoji)

  const daily = run.mode === 'daily'
  const close = onClose ?? (() => useGame.getState().showArrival(run.runId, false))
  const tile3 = third ?? { label: '도착 순서', value: run.result?.order ?? null, unit: '번째' }
  const subtitle = daily
    ? `${puzzle.date ? `${formatDateKo(puzzle.date).replace(/ \S+요일$/, '')}, ` : ''}${puzzle.number}번째 링클`
    : run.mode === 'archive'
      ? `${puzzle.number}번째 링클을 지난 문제로 풀었어요`
      : puzzle.kind === 'random'
        ? `링클 랜덤 ${puzzle.number}번`
        : `링클 커뮤니티 ${puzzle.number}번`
  // 오늘의 문제가 아니면 "결과 공유"가 "도전장 보내기"가 된다(설계 문서 16.2). 서버가 판을 받은 뒤에 만들 수 있다
  const challengeable = !daily && !run.runId.startsWith(ADMIN_RUN_PREFIX)
  const ready = run.outbox === 'none'

  // 오늘의 문제로 연속 일수가 방금 늘었으면 축하 화면이 먼저 나온다
  if (daily && celebrate && celebrate === puzzle.date) {
    return <StreakCelebration stats={stats} today={puzzle.date ?? kstDate(now())} onDone={() => useStats.getState().celebrated()} />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 min-[360px]:px-5 pt-[max(20px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-white">
          <Flag className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold leading-[30px] tracking-[-0.01em] text-ink">{puzzle.end.title}에 도착!</h1>
          <p className="text-[14px] leading-5 text-ink-2">{subtitle}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="이동" value={moveCount(run)} unit="번" />
        <Tile label="시간" value={formatClock(elapsedMs(run, run.finishedAt ?? 0))} />
        <Tile label={tile3.label} value={tile3.value} unit={tile3.unit} />
      </dl>

      <Card className="mt-3 !px-4 !pb-3 !pt-2" aria-label="지나온 길">
        <ol>
          <Step kind="start" title={puzzle.start.title} note="출발" strong href={wikiUrl(puzzle.start.title)} />
          {run.events.map((e, i) => {
            const kind = kinds?.[i] ?? (e.type === 'back' ? 'back' : e.to.id === puzzle.end.id ? 'goal' : 'unknown')
            return <Step key={i} kind={kind} title={e.to.title} note={kind === 'back' ? '되돌아감' : kind === 'goal' ? '도착' : undefined} strong={kind === 'goal'} muted={kind === 'back'} href={wikiUrl(e.to.title)} />
          })}
        </ol>
        <p className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-2.5 text-[13px] leading-[18px] text-ink-2">
          목표와 멀어요
          {([1, 2, 3, 4, 5] as const).map(k => (
            <Sq key={k} kind={k} size={14} />
          ))}
          가까워요
          {!run.emoji && <Spinner className="ml-auto h-4 w-4" />}
        </p>
      </Card>

      <p className="mt-2 px-1 text-[12px] leading-[18px] text-ink-2">
        문서 이름을 누르면 위키백과 원문이 열려요. 글은 위키백과 기여자들이 썼고{' '}
        <a href={CC_BY_SA.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {CC_BY_SA.name}
        </a>
        를 따라요.
      </p>

      {run.challenge && ready && <ChallengeResult code={run.challenge} />}

      {children && <div className="mt-3 flex flex-col gap-3">{children}</div>}

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-secondary from-70% to-transparent pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        {challengeable ? (
          <>
            <Cta onClick={async () => setToast(await sendChallenge(run))} disabled={!run.emoji || !ready}>
              <Send className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              {run.challenge ? '나도 도전장 보내기' : '도전장 보내기'}
            </Cta>
            <p className="mt-1.5 text-center text-[13px] leading-5 text-ink-2">결과와 함께 이 문제로 겨루는 링크가 가요</p>
          </>
        ) : (
          <Cta onClick={async () => setToast(await shareRun(run))} disabled={!run.emoji}>
            <Share2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            결과 공유
          </Cta>
        )}
        <div className={`mt-1 flex items-center ${daily ? 'justify-between' : 'justify-center'}`}>
          {daily && <Countdown />}
          <TextButton onClick={close} className={daily ? '-mr-3' : ''}>
            {closeLabel}
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
          </TextButton>
        </div>
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

/** 도전장으로 푼 판: 나와 보낸 사람, 두 길, 같은 링크로 푼 사람끼리의 순위 */
function ChallengeResult({ code }: { code: string }) {
  const { data } = useLoad(`challenge:${code}`, () => getChallenge(code))
  if (!data?.compare) return null
  return (
    <div className="mt-3 flex flex-col gap-3">
      <VsCards me={data.compare.mine} them={data.sender} byMoves={data.byAuthor} />
      <Card className="!p-4">
        <TwoPaths mine={data.compare.mine.path} theirs={data.compare.theirs.path} />
      </Card>
      <Card aria-label="이 도전장 순위">
        <CardTitle side={`${data.board.length}명`}>이 도전장 순위</CardTitle>
        <ChallengeBoard data={data} />
      </Card>
    </div>
  )
}

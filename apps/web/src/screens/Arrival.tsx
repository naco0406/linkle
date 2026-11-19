import { useCallback, useState } from 'react'
import { ChevronRight, Flag, Share2 } from 'lucide-react'
import { elapsedMs, formatClock, kstDate, moveCount, type Run } from '@linkle/core'
import { useStats } from '../game/stats'
import { now, useGame } from '../game/store'
import { useEmoji } from '../game/useEmoji'
import { Card, Countdown, Cta, formatDateKo, kindOfEmoji, PathStep as Step, Sq, StatTile as Tile, TextButton } from '../ui/cards'
import { Spinner, Toast } from '../ui/parts'
import { shareRun } from '../ui/share'
import { StreakCelebration } from '../ui/Streak'

/**
 * 도착 화면. 목표에 닿은 직후 한 번 뜨고, "홈으로"를 누르면 닫힌다.
 * 숫자 셋을 타일로, 지나온 길을 문서마다 색이 붙은 목록으로 보여 준다.
 */
export function Arrival({ run }: { run: Run }) {
  useEmoji(run)
  const stats = useStats(s => s.stats)
  const celebrate = useStats(s => s.celebrate)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const { puzzle } = run
  const kinds = run.emoji?.map(kindOfEmoji)

  // 연속 일수가 방금 늘었으면 축하 화면이 먼저 나온다
  if (celebrate && celebrate === puzzle.date) {
    return <StreakCelebration stats={stats} today={puzzle.date ?? kstDate(now())} onDone={() => useStats.getState().celebrated()} />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pt-[max(20px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-white">
          <Flag className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold leading-[30px] tracking-[-0.01em] text-ink">{puzzle.end.title}에 도착!</h1>
          <p className="text-[14px] leading-5 text-ink-2">
            {puzzle.number}번째 링클{puzzle.date ? ` · ${formatDateKo(puzzle.date).replace(/ \S+요일$/, '')}` : ''}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="이동" value={moveCount(run)} unit="번" />
        <Tile label="시간" value={formatClock(elapsedMs(run, run.finishedAt ?? 0))} />
        <Tile label="도착 순서" value={run.result?.order ?? null} unit="번째" />
      </dl>

      <Card className="mt-3 !px-4 !pb-3 !pt-2" aria-label="지나온 길">
        <ol>
          <Step kind="start" title={puzzle.start.title} note="출발" strong />
          {run.events.map((e, i) => {
            const kind = kinds?.[i] ?? (e.type === 'back' ? 'back' : e.to.id === puzzle.end.id ? 'goal' : 'unknown')
            return <Step key={i} kind={kind} title={e.to.title} note={kind === 'back' ? '되돌아감' : kind === 'goal' ? '도착' : undefined} strong={kind === 'goal'} muted={kind === 'back'} />
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

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-secondary from-70% to-transparent pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        <Cta onClick={async () => setToast(await shareRun(run))} disabled={!run.emoji}>
          <Share2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          결과 공유
        </Cta>
        <div className="mt-1 flex items-center justify-between">
          <Countdown />
          <TextButton onClick={() => useGame.getState().showArrival(run.runId, false)} className="-mr-3">
            홈으로
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
          </TextButton>
        </div>
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

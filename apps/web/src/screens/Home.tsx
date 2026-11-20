import { useCallback, useState } from 'react'
import { ChevronRight, CircleHelp, Share2 } from 'lucide-react'
import { Link } from 'react-router'
import { createRun, elapsedMs, formatClock, kstDate, moveCount, type Run } from '@linkle/core'
import { startDaily } from '../game/api'
import { useStats } from '../game/stats'
import { now, useGame } from '../game/store'
import { useEmoji } from '../game/useEmoji'
import { Card, Countdown, Cta, formatDateKo, HowTo, kindOfEmoji, Route, Sq } from '../ui/cards'
import { Help, Spinner, Toast } from '../ui/parts'
import { shareRun } from '../ui/share'
import { StreakCard, StreakChip } from '../ui/Streak'
import { YesterdayPreview } from './Yesterday'

/**
 * 홈. 가운데의 "오늘의 링클" 카드 한 장이 시작 전과 끝난 뒤 두 모습으로 바뀐다.
 * 그 아래에는 처음 온 사람에게는 게임 방법을, 한 번이라도 푼 사람에게는 연속 기록을 보여 준다.
 */
export function Home({ run }: { run: Run | null }) {
  // 번호와 날짜는 서버가 알려 준 오늘의 것이다. 날짜가 넘어가면 sync가 다시 받아 와 여기도 바뀐다
  const today = useGame(s => s.today)
  const stats = useStats(s => s.stats)
  const [help, setHelp] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const date = today?.date ?? kstDate(now())
  const finished = run?.phase === 'finished' ? run : null
  const noPuzzle = useGame(s => s.noPuzzle)

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 pb-6">
      <header className="flex h-14 flex-none items-center justify-between">
        <StreakChip stats={stats} today={date} onClick={() => document.getElementById('streak')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        <button onClick={() => setHelp(true)} aria-label="게임 방법" className="press -mr-2 ml-auto grid h-10 w-10 place-items-center rounded-full text-ink">
          <CircleHelp className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </header>

      <div className="pb-5 pt-1 text-center">
        <h1 className="font-brand text-[52px] font-normal leading-[56px] text-primary">Linkle</h1>
        <p className="mt-1 text-[16px] leading-6 text-ink">매일 위키피디아 탐험하기</p>
      </div>

      {finished ? (
        <DoneCard run={finished} onToast={setToast} />
      ) : noPuzzle && !run ? (
        <Card lift aria-label="오늘의 링클">
          <span className="text-[15px] font-semibold leading-[22px] text-primary">오늘의 링클</span>
          <p className="mt-0.5 text-[22px] font-bold leading-[31px] text-ink">{formatDateKo(date)}</p>
          <p className="mt-3 text-[15px] leading-[22px] text-ink-2">오늘 문제를 준비하고 있어요. 조금 뒤에 다시 와 주세요.</p>
        </Card>
      ) : <TodayCard number={run?.puzzle.number ?? today?.number ?? null} date={date} finishedCount={today?.finishedCount ?? null} onToast={setToast} />}

      <div id="streak" className="mt-3">
        {stats.played > 0 ? <StreakCard stats={stats} today={date} /> : <HowTo />}
      </div>
      {/* 오늘을 끝낸 사람에게만 어제의 링클을 권한다. 시작 전에는 오늘 문제에 집중하게 한다 */}
      {finished && (
        <div className="mt-3">
          <YesterdayPreview />
        </div>
      )}

      {/* 위키백과 글의 출처와 라이선스, 만든 사람 */}
      <Link to="/about" className="press mx-auto mt-6 flex h-10 items-center rounded-full px-4 text-[13px] font-medium text-ink-2">
        링클 정보 · 라이선스
      </Link>

      {help && <Help onClose={() => setHelp(false)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

function CardHead({ label, number }: { label: string; number: number | null }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[15px] font-semibold leading-[22px] text-primary">{label}</span>
      <span className="font-brand text-xl leading-6 text-primary">{number === null ? '' : `#${number}`}</span>
    </div>
  )
}

/** 시작 전. 출발과 목표는 잠겨 있고, 시작을 누르면 열린다 */
function TodayCard({ number, date, finishedCount, onToast }: { number: number | null; date: string; finishedCount: number | null; onToast: (m: string) => void }) {
  const [starting, setStarting] = useState(false)
  const start = async () => {
    setStarting(true)
    try {
      const s = await startDaily()
      useGame.getState().begin('daily', createRun({ mode: s.mode, puzzle: s.puzzle, runId: s.runId, startedAt: s.startedAt }), s.serverNow)
    } catch {
      onToast('시작하지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setStarting(false)
    }
  }
  return (
    <Card lift aria-label="오늘의 링클">
      <CardHead label="오늘의 링클" number={number} />
      <p className="mt-0.5 text-[22px] font-bold leading-[31px] text-ink">{formatDateKo(date)}</p>
      <div className="mt-4">
        <Route />
      </div>
      <p className="mb-4 mt-3 text-center text-[15px] leading-[22px] text-ink-2">
        {finishedCount === null ? ' ' : finishedCount > 0 ? (
          <>
            지금까지 <b className="font-semibold tabular-nums text-ink">{finishedCount.toLocaleString('ko-KR')}명</b>이 도착했어요
          </>
        ) : (
          '아직 아무도 도착하지 않았어요'
        )}
      </p>
      <Cta onClick={start} disabled={starting}>
        {starting ? <Spinner className="h-6 w-6 text-white" /> : '시작'}
      </Cta>
      <p className="mt-2 text-center text-[13px] leading-5 text-ink-2">누르면 두 문서가 공개되고 시간이 흐르기 시작해요</p>
    </Card>
  )
}

/** 끝난 뒤. 같은 카드가 결과 요약으로 바뀐다 */
function DoneCard({ run, onToast }: { run: Run; onToast: (m: string) => void }) {
  useEmoji(run)
  return (
    <Card lift aria-label="오늘의 링클 결과">
      <CardHead label="오늘의 링클 · 도착 완료" number={run.puzzle.number} />
      <div className="mt-4">
        <Route start={run.puzzle.start.title} end={run.puzzle.end.title} />
      </div>
      <button onClick={() => useGame.getState().showArrival(run.runId, true)} className="press my-4 flex w-full items-center gap-3 rounded-xl text-left" aria-label="경로 다시 보기">
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">{run.emoji ? run.emoji.map((e, i) => <Sq key={i} kind={kindOfEmoji(e)} size={24} />) : <Spinner className="h-6 w-6" />}</span>
        <span className="flex flex-none items-center text-[14px] tabular-nums text-ink-2">
          {moveCount(run)}번 · {formatClock(elapsedMs(run, run.finishedAt ?? 0))}
          <ChevronRight className="h-[18px] w-[18px] text-[#b3bcc6]" aria-hidden />
        </span>
      </button>
      <Cta onClick={async () => onToast(await shareRun(run))} disabled={!run.emoji}>
        <Share2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        결과 공유
      </Cta>
      <Countdown className="mt-2" />
    </Card>
  )
}

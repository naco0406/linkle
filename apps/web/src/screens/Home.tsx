import { useCallback, useEffect, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { createRun, elapsedMs, formatDurationKo, moveCount, pathOf, shareText, type Run } from '@linkle/core'
import { getToday, startDaily } from '../game/api'
import { computeEmoji } from '../game/emoji'
import { useGame } from '../game/store'
import { Help, PathTrail, PrimaryButton, Spinner, Stat, Toast } from '../ui/parts'

/** 게임 화면이 아닐 때의 화면. 시작 전이면 시작 버튼을, 끝났으면 결과를 보여 준다 */
export function Home({ run }: { run: Run | null }) {
  const [number, setNumber] = useState<number | null>(run?.puzzle.number ?? null)
  const [starting, setStarting] = useState(false)
  const [help, setHelp] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (number === null) void getToday().then(t => setNumber(t.number))
  }, [number])

  const start = async () => {
    setStarting(true)
    try {
      const s = await startDaily()
      useGame.getState().begin(createRun({ mode: 'daily', puzzle: s.puzzle, runId: s.runId, startedAt: s.startedAt }), s.serverNow)
    } catch {
      setToast('시작하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.')
      setStarting(false)
    }
  }

  return (
    <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden bg-secondary px-4 py-24">
      <header className="absolute right-0 top-0 flex h-20 items-center px-4">
        <button onClick={() => setHelp(true)} aria-label="게임 방법" className="rounded-full p-2 text-ink hover:bg-white/70">
          <CircleHelp className="h-6 w-6" />
        </button>
      </header>

      <div className="flex flex-row gap-2 pl-8">
        <h1 className="pt-6 font-brand text-6xl font-normal text-primary sm:text-8xl">Linkle</h1>
        <p className="font-brand text-primary">{number === null ? '' : `#${number}`}</p>
      </div>

      {run?.phase === 'finished' ? (
        <Result run={run} onToast={setToast} />
      ) : (
        <>
          <p className="mb-14 mt-2 text-xl text-ink">매일 위키피디아 탐험하기</p>
          <PrimaryButton onClick={start} disabled={starting}>
            {starting ? <Spinner className="h-6 w-6 text-white" /> : '시작'}
          </PrimaryButton>
        </>
      )}

      <p className="absolute bottom-10 text-center text-xs text-ink">
        © 2024 <span className="font-semibold text-primary">Linkle</span>. All rights reserved.
      </p>
      {help && <Help onClose={() => setHelp(false)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

function Result({ run, onToast }: { run: Run; onToast: (m: string) => void }) {
  // 이모지는 기기에서 계산한다. 아직 없으면 지금 계산해 저장한다
  useEffect(() => {
    if (run.emoji) return
    let alive = true
    computeEmoji(run)
      .then(emoji => alive && useGame.getState().setEmoji(run.runId, emoji))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [run])

  const share = async () => {
    const text = shareText(run, { origin: window.location.origin })
    const ok = await copyText(text)
    onToast(ok ? '결과가 클립보드에 복사되었습니다.' : '복사하지 못했습니다. 브라우저의 복사 권한을 확인해 주세요.')
  }

  return (
    <div className="mt-6 flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex w-full flex-col gap-4">
        <div className="my-4 flex flex-col gap-2 text-center">
          <div className="text-xl font-semibold text-ink">{run.puzzle.number}번째 링클을 클리어했습니다!</div>
          {run.result && (
            <div className="text-ink">
              일일 순위 : <span className="font-semibold text-primary">{run.result.order}</span>등
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Stat label="소요 시간">{formatDurationKo(elapsedMs(run, run.finishedAt ?? 0))}</Stat>
          <Stat label="이동 횟수">{moveCount(run)}</Stat>
        </div>
        <div className="rounded-xl border-2 border-line-blue bg-white px-4 py-4">
          <PathTrail titles={pathOf(run).map(s => s.page.title)} className="max-h-48 overflow-y-auto" />
        </div>
        <div className="min-h-8 text-center text-2xl tracking-wide" aria-label="경로의 유사도">
          {run.emoji ? run.emoji.join('') : <Spinner className="mx-auto h-6 w-6" />}
        </div>
      </div>
      <PrimaryButton onClick={share} disabled={!run.emoji} className="w-full max-w-[250px] px-0">
        결과 공유
      </PrimaryButton>
    </div>
  )
}

/** 클립보드 API가 막힌 환경(일부 인앱 브라우저)에서는 예전 방식으로 한 번 더 시도한다 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      area.remove()
    }
  }
}

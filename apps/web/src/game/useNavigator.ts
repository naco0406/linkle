import { useCallback, useEffect, useRef, useState } from 'react'
import { currentPage, type Run } from '@linkle/core'
import { makeLead } from '@linkle/embed'
import type { CleanPage } from '@linkle/wiki'
import { errorMessage, isAbort, loadPage } from './pages'
import { runIn, useGame, type Slot } from './store'

/**
 * 문서 이동을 맡는다. 이동은 문서를 실제로 받았을 때만 로그에 확정된다.
 * 받는 중에는 다른 클릭을 받지 않고, 실패하면 현재 문서에 그대로 머문다.
 */
export function useNavigator(run: Run, slot: Slot = 'daily') {
  const current = currentPage(run)
  const [page, setPage] = useState<CleanPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 지금 열고 있는 링크의 이름 */
  const [opening, setOpening] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const lock = useRef(false)

  // 화면의 문서를 로그의 현재 문서에 맞춘다: 첫 진입, 새로고침, 뒤로가기, 다른 탭에서의 이동
  useEffect(() => {
    if (page?.id === current.id) return
    const ctrl = new AbortController()
    setBusy(true)
    loadPage(current.title, ctrl.signal)
      .then(p => {
        setPage(p)
        setError(null)
        setBusy(false)
      })
      .catch(e => {
        if (isAbort(e)) return
        setError(errorMessage(e))
        setBusy(false)
      })
    return () => ctrl.abort()
    // page는 일부러 뺐다. 현재 문서가 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, current.title, retryKey])

  const go = useCallback(
    async (via: string) => {
      if (lock.current || run.phase !== 'playing') return
      lock.current = true
      setBusy(true)
      setOpening(via)
      setError(null)
      try {
        const next = await loadPage(via)
        if (next.id !== currentPage(runIn(useGame.getState(), slot) ?? run).id) {
          setPage(next)
          useGame.getState().link(slot, { to: { id: next.id, title: next.title }, via, lead: makeLead(next.title, next.leadText) })
        }
      } catch (e) {
        if (!isAbort(e)) setError(errorMessage(e))
      } finally {
        lock.current = false
        setBusy(false)
        setOpening(null)
      }
    },
    [run, slot],
  )

  const back = useCallback(() => {
    if (lock.current) return
    useGame.getState().back(slot)
  }, [slot])

  const retry = useCallback(() => setRetryKey(k => k + 1), [])
  const dismissError = useCallback(() => setError(null), [])

  return { page, busy, opening, error, go, back, retry, dismissError }
}

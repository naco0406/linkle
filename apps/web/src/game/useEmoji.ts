import { useEffect } from 'react'
import type { Run } from '@linkle/core'
import { computeEmoji } from './emoji'
import { useGame } from './store'

/** 끝난 판의 이모지가 아직 없으면 기기에서 계산해 저장한다 */
export function useEmoji(run: Run | null): void {
  useEffect(() => {
    if (!run || run.phase !== 'finished' || run.emoji) return
    let alive = true
    computeEmoji(run)
      .then(emoji => alive && useGame.getState().setEmoji(run.runId, emoji))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [run])
}

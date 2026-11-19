import type { MoveEvent } from './types.ts'

/** 도착 문서와의 유사도 5단계. 멀수록 빨강, 가까울수록 파랑 */
export const LEVEL_EMOJI = ['🟥', '🟧', '🟨', '🟩', '🟦'] as const
export const BACK_EMOJI = '⏪'
export const GOAL_EMOJI = '🏁'
/** 유사도를 아직 구하지 못한 문서 */
export const UNKNOWN_EMOJI = '⬜'

export type Level = 0 | 1 | 2 | 3 | 4

/** 0~1로 편 유사도를 20% 단위 5단계로 나눈다 */
export function levelOf(score01: number): Level {
  if (!(score01 > 0)) return 0
  return Math.min(4, Math.floor(score01 * 5)) as Level
}

/**
 * 이동 로그를 이모지 배열로 바꾼다. 이동 한 번에 이모지 하나다.
 * 뒤로가기는 ⏪, 도착 문서는 🏁, 나머지는 그 문서의 유사도 단계.
 */
export function emojiOf(events: readonly MoveEvent[], endId: number, levelOfPage: (pageId: number) => Level | null): string[] {
  return events.map(e => {
    if (e.type === 'back') return BACK_EMOJI
    if (e.to.id === endId) return GOAL_EMOJI
    const level = levelOfPage(e.to.id)
    return level === null ? UNKNOWN_EMOJI : LEVEL_EMOJI[level]
  })
}

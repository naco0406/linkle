import type { Ghost, MoveEvent } from './types.ts'

/**
 * 끝난 판에서 고스트를 만든다. 문서 이름은 넣지 않는다(도전장을 받은 사람에게 스포일러가 되지 않게).
 * emoji는 그 판의 이모지 배열(없으면 빈 칸).
 */
export function ghostOf(name: string, events: readonly MoveEvent[], emoji: readonly string[] | null, ms: number): Ghost {
  return { name, moves: events.length, ms, steps: events.map((e, i) => ({ at: e.at, emoji: emoji?.[i] ?? '⬜' })) }
}

/** 경과 시간 elapsed에 고스트가 몇 번째 이동이었는지, 마지막 이동의 이모지, 도착했는지 */
export function ghostAt(ghost: Ghost, elapsed: number): { moves: number; emoji: string | null; arrived: boolean } {
  let moves = 0
  for (const s of ghost.steps) {
    if (s.at > elapsed) break
    moves++
  }
  return { moves, emoji: moves > 0 ? ghost.steps[moves - 1]!.emoji : null, arrived: elapsed >= ghost.ms && moves === ghost.steps.length }
}

/** 두 경로가 처음 갈린 자리(0부터). 끝까지 같으면 짧은 쪽의 길이 */
export function forkIndex(a: readonly number[], b: readonly number[]): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

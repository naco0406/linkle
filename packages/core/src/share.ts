import { moveCount, elapsedMs } from './run.ts'
import { formatDurationKo } from './time.ts'
import type { Run } from './types.ts'

/**
 * 공유 문구. 출발·도착 문서와 경로는 넣지 않는다.
 * 오늘의 문제는 기존 링클의 문구를 그대로 따른다.
 */
export function shareText(run: Run, opts: { origin: string }): string {
  if (run.phase !== 'finished' || run.finishedAt === null) throw new Error('finished run only')
  const { puzzle, mode } = run
  const head =
    mode === 'daily'
      ? `${puzzle.number}번째 링클을 클리어했습니다!`
      : mode === 'archive'
        ? `${puzzle.number}번째 링클(지난 문제)을 클리어했습니다!`
        : `링클 커뮤니티 ${puzzle.number}번 문제를 클리어했습니다!`
  const lines = [head]
  if (mode === 'daily' && run.result?.order != null) lines.push(`일일 순위 : ${run.result.order}등`)
  if (mode === 'community' && run.result?.rank != null) lines.push(`순위 : ${run.result.rank}위`)
  lines.push(`이동 횟수: ${moveCount(run)}`)
  lines.push(`소요 시간: ${formatDurationKo(elapsedMs(run, run.finishedAt))}`)
  if (run.emoji) lines.push('', run.emoji.join(''))
  const url = mode === 'community' ? `${opts.origin}/community/${puzzle.id}` : `${opts.origin}/`
  lines.push('', url)
  return lines.join('\n')
}

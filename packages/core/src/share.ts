import { moveCount, elapsedMs } from './run.ts'
import { formatDurationShort } from './time.ts'
import type { Run } from './types.ts'

/**
 * 공유 문구. 크릴리온처럼 제목, 점수, 이모지 세 덩어리로 짧게 쓴다(2026-11-20 사용자 결정, 후보 A).
 *
 *   Linkle #2 🔗
 *   3번 36초
 *
 *   🟥🟧🏁
 *
 * 출발·도착 문서와 경로는 넣지 않는다(스포일러). 가운뎃점(·)은 쓰지 않는다.
 * 복사할 때 두 가지를 함께 넣는다:
 *   html  제목에 링크를 건다. 서식 있는 붙여넣기를 받는 앱에서 하이퍼링크가 된다
 *   text  글자만 받는 앱을 위해 마지막 줄에 주소를 붙인다
 */
export type Share = { text: string; html: string; url: string }

export function shareOf(run: Run, opts: { origin: string; challenge?: string }): Share {
  if (run.phase !== 'finished' || run.finishedAt === null) throw new Error('finished run only')
  const { puzzle, mode } = run
  const name = puzzleName(puzzle)
  // 도전장(설계 문서 16.2): 첫 줄이 "도전장"이 되고 주소가 /c/코드로 바뀐다. 나머지는 그대로다
  const title = opts.challenge ? `${name} 도전장` : name
  const score = `${moveCount(run)}번 ${formatDurationShort(elapsedMs(run, run.finishedAt))}${mode === 'archive' ? ' (지난 문제)' : ''}`
  const url = opts.challenge
    ? `${opts.origin}/c/${opts.challenge}`
    : mode === 'community'
      ? `${opts.origin}/community/${puzzle.id}`
      : mode === 'archive'
        ? `${opts.origin}/archive/${puzzle.id}`
        : `${opts.origin}/`
  const emoji = run.emoji?.join('') ?? null
  const body = [score, ...(emoji ? ['', emoji] : [])]
  const text = [`${title} 🔗`, ...body, '', url.replace(/^https?:\/\//, '').replace(/\/$/, '')].join('\n')
  const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const html = [`<a href="${esc(url)}">${esc(title)}</a> 🔗`, ...body.map(esc)].join('<br>')
  return { text, html, url }
}

/** 문제의 이름. 공유 문구와 화면 제목이 같이 쓴다 */
export function puzzleName(puzzle: Pick<Run['puzzle'], 'kind' | 'number'>): string {
  if (puzzle.kind === 'community' || puzzle.kind === 'official') return `Linkle 커뮤니티 #${puzzle.number}`
  if (puzzle.kind === 'random') return `Linkle 랜덤 #${puzzle.number}`
  return `Linkle #${puzzle.number}`
}

/** 글자만 필요한 곳(시험, 예전 호출) */
export function shareText(run: Run, opts: { origin: string }): string {
  return shareOf(run, opts).text
}

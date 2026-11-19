/** 위키 문서 하나. 비교는 항상 id로 한다 */
export type Page = { id: number; title: string }

export type MoveEvent =
  /** via: 누른 링크의 제목(넘겨주기 전). at: startedAt 기준 경과 ms */
  | { type: 'link'; to: Page; via: string; at: number }
  | { type: 'back'; to: Page; at: number }

export type PuzzleKind = 'daily' | 'official' | 'community'

export type Puzzle = {
  id: number
  kind: PuzzleKind
  /** kind별 일련번호 */
  number: number
  /** daily만. KST YYYY-MM-DD */
  date: string | null
  start: Page
  end: Page
}

export type RunMode = 'daily' | 'archive' | 'community'

/** 저장 형식의 버전. 바뀌면 이전 저장분은 읽지 않고 버린다 */
export const RUN_VERSION = 1

export type Run = {
  v: typeof RUN_VERSION
  mode: RunMode
  puzzle: Puzzle
  runId: string
  phase: 'playing' | 'finished'
  /** 서버 시각 (ms) */
  startedAt: number
  finishedAt: number | null
  /** 이동 로그. 경로, 뒤로가기 대상, 이동 횟수는 모두 여기서 계산한다 */
  events: MoveEvent[]
  /** 문서 id → "제목: 첫 300자". 유사도 계산용 */
  leads: Record<number, string>
  /** 실격이 아니라 표시. 통계 후보에서만 빠진다 */
  flags: string[]
  /** 기기에서 계산한 이모지 */
  emoji: string[] | null
  /** 서버 응답 */
  result: { order: number } | null
  /** 완료 제출을 다시 보내야 하는지 */
  outbox: 'none' | 'pending'
}

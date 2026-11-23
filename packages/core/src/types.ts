/** 위키 문서 하나. 비교는 항상 id로 한다 */
export type Page = { id: number; title: string }

export type MoveEvent =
  /** via: 누른 링크의 제목(넘겨주기 전). at: startedAt 기준 경과 ms */
  | { type: 'link'; to: Page; via: string; at: number }
  | { type: 'back'; to: Page; at: number }

/** random: 같이 달리기의 랜덤 풀(목록에 나오지 않는다, 설계 문서 16.3.3) */
export type PuzzleKind = 'daily' | 'official' | 'community' | 'random'

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
  /** 서버 응답. order: 그 문제를 몇 번째로 끝냈는지, rank: 커뮤니티 순위표의 자리. 기록에 들지 않는 판은 null */
  result: { order: number | null; rank?: number | null } | null
  /** 완료 제출을 다시 보내야 하는지 */
  outbox: 'none' | 'pending'
  /** 도전장으로 시작한 판이면 그 코드와 보낸 사람의 고스트(설계 문서 16.2) */
  challenge?: string
  ghost?: Ghost
  /** 같이 달리기 방에서 달린 판(16.3) */
  room?: { code: string; round: number }
  /** 같이 달리기에서 도착하기 전에 판이 끝났다(다른 사람이 먼저 도착, 시간 끝, 포기) */
  stopped?: boolean
}

/** 도전장을 보낸 사람의 진행. 문서 이름은 없다: 같은 경과 시간에 몇 번째였는지와 그 문서의 색만 */
export type Ghost = { name: string; moves: number; ms: number; steps: { at: number; emoji: string }[] }

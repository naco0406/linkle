import type { Page } from './types.ts'

// 어제의 기록 API(GET /api/yesterday)의 응답. Worker와 웹이 같은 모양을 쓴다.

/** 어제의 기록에 오르는 한 판. 누가 했는지는 담지 않는다: 언제, 어떻게만 보여 준다 */
export type DailyRecord = {
  moves: number
  durationMs: number
  /** 출발부터 도착까지 지난 문서. back은 되돌아간 이동 */
  path: { id: number; title: string; back: boolean }[]
  /** 기기가 계산해 보낸 유사도 이모지. 형식이 맞지 않으면 null */
  emoji: string[] | null
}

export type YesterdayStats = {
  status: 'ready'
  date: string
  number: number
  start: Page
  end: Page
  /** 그날 도착한 사람 수 */
  finished: number
  /** 이동 횟수 → 그 횟수로 도착한 사람 수 */
  moves: Record<number, number>
  /** 걸린 시간의 가운데 값 */
  medianMs: number | null
  /** 많이 지나간 문서. 출발·도착은 빼고, count는 그 문서를 지난 사람 수 */
  topPages: { id: number; title: string; count: number }[]
  /** 가장 적게 이동한 기록과 가장 빨리 도착한 기록. 위키백과에서 경로를 확인한 것만 오른다 */
  shortest: DailyRecord | null
  fastest: DailyRecord | null
  /** 기록 확인이 아직 끝나지 않았다 */
  verifying: boolean
}

export type Yesterday =
  /** 어제는 문제가 없었다 (첫날) */
  | { status: 'none'; date: string }
  /** 아직 모으는 중이다 (자정 직후) */
  | { status: 'pending'; date: string; number: number }
  | YesterdayStats

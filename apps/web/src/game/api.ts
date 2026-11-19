import { kstDate, type Puzzle } from '@linkle/core'

// 서버(구현 순서 6번)가 생기기 전까지 쓰는 로컬 대역이다.
// 함수의 모양은 설계 문서 3.8의 API와 같게 두어, 나중에 fetch 호출로 바꾸기만 하면 된다.

export type Today = { date: string; number: number; serverNow: number }
export type Started = { runId: string; startedAt: number; serverNow: number; puzzle: Puzzle }

const LOCAL_PUZZLE = {
  start: { id: 7761, title: '불고기' },
  end: { id: 1043098, title: '뉴발란스' },
}

export async function getToday(): Promise<Today> {
  const now = Date.now()
  return { date: kstDate(now), number: 1, serverNow: now }
}

/** 오늘의 문제를 시작한다. 출발·도착 문서는 여기서 처음 받는다 */
export async function startDaily(): Promise<Started> {
  const today = await getToday()
  return {
    runId: crypto.randomUUID(),
    startedAt: today.serverNow,
    serverNow: today.serverNow,
    puzzle: { id: 1, kind: 'daily', number: today.number, date: today.date, ...LOCAL_PUZZLE },
  }
}

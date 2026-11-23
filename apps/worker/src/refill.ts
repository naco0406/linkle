// 대기열이 줄면 문제 채우기(GitHub Actions의 .github/workflows/puzzles.yml)를 부른다(설계 문서 7.5).
// 달력에 맞춰 돌지 않고 남은 양을 보고 채운다. 밖에서 부르는 실행이라 GitHub의 "60일 동안 활동이 없으면 예약 실행을 멈춘다" 규칙에도 걸리지 않는다.
// 열쇠는 이 저장소의 Actions 실행 권한만 가진 GitHub 토큰이다(Worker 비밀값 GITHUB_DISPATCH_TOKEN, 운영자가 직접 만들어 넣는다).

/** 오늘의 문제가 이만큼 아래로 남으면 채운다. 채우기는 한 시간 안팎이라 열흘이면 넉넉하다 */
export const REFILL_BELOW = 10
/** 같이 달리기의 랜덤 풀이 이만큼 아래로 남아도 채운다(설계 문서 16.3.3). 한 번 채우면 40개가 들어온다 */
export const RANDOM_BELOW = 60
/** 한 번 부르면 이만큼은 다시 부르지 않는다. 도는 중이거나 실패했을 때 매시 부르지 않게. 실패하면 다음 날 다시 한다 */
export const REFILL_COOLDOWN_MS = 20 * 60 * 60 * 1000
export const WORKFLOW = { repo: 'naco0406/linkle', file: 'puzzles.yml', ref: 'main' } as const

/** 마지막으로 부른 때와 GitHub의 답(204면 받아들여졌다) */
export type RefillState = { at: number; ok: boolean; status: number; left: number }

export function shouldRefill(left: number, last: RefillState | null, now: number): boolean {
  if (left >= REFILL_BELOW) return false
  return !last || now - last.at >= REFILL_COOLDOWN_MS
}

export function dispatchRequest(token: string): Request {
  return new Request(`https://api.github.com/repos/${WORKFLOW.repo}/actions/workflows/${WORKFLOW.file}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      // GitHub API는 User-Agent가 없는 요청을 받지 않는다
      'user-agent': 'linkle-worker',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: WORKFLOW.ref }),
  })
}

export async function readRefill(db: D1Database): Promise<RefillState | null> {
  const row = await db.prepare(`SELECT value FROM job_state WHERE key = 'refill'`).first<{ value: string }>()
  if (!row) return null
  try {
    return JSON.parse(row.value) as RefillState
  } catch {
    return null
  }
}

type Send = (r: Request) => Promise<Response>

export async function queueLeft(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT (SELECT COUNT(*) FROM puzzle_queue WHERE status = 'approved' AND pool = 'daily') AS n, (SELECT COUNT(*) FROM puzzles WHERE kind = 'random' AND status = 'published') AS r`)
    .first<{ n: number; r: number }>()
  // 랜덤 풀이 모자라면 대기열이 넉넉해도 채운다. 채우기 한 번이 둘 다 채운다
  return lowestOf(row?.n ?? 0, row?.r ?? 0)
}

/** 랜덤 풀의 부족을 대기열 기준으로 바꿔 말한다: 랜덤이 기준 아래면 대기열이 기준 아래인 것처럼 */
export function lowestOf(queue: number, random: number): number {
  return random < RANDOM_BELOW ? Math.min(queue, REFILL_BELOW - 1) : queue
}

/** GitHub에 문제 채우기를 부르고, 그 결과를 남긴다. 예약 작업과 관리자 화면의 "지금 채우기"가 함께 쓴다 */
export async function dispatchRefill(db: D1Database, token: string, now: number, left: number, send: Send = r => fetch(r)): Promise<RefillState> {
  let status = 0
  try {
    status = (await send(dispatchRequest(token))).status
  } catch {
    // 닿지 못한 것도 실패로 남긴다
  }
  const state: RefillState = { at: now, ok: status >= 200 && status < 300, status, left }
  await db
    .prepare(`INSERT INTO job_state (key, value) VALUES ('refill', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
    .bind(JSON.stringify(state))
    .run()
  return state
}

export async function refillIfLow(db: D1Database, token: string | undefined, now: number, send?: Send): Promise<string> {
  const [left, last] = await Promise.all([queueLeft(db), readRefill(db)])
  if (!shouldRefill(left, last, now)) return `대기열 ${left}개`
  if (!token) return `대기열 ${left}개, GITHUB_DISPATCH_TOKEN이 없어 채우기를 부르지 못함`
  // 실패하면 20시간 뒤(다음 날) 다시 한다
  const state = await dispatchRefill(db, token, now, left, send)
  return `대기열 ${left}개, 문제 채우기 ${state.ok ? '부름' : `실패(${state.status})`}`
}

/** 관리자가 직접 부를 때. 방금 부른 것이 받아들여졌으면 한 시간은 막는다. 채우기가 도는 중이라 두 번 누르면 80개가 들어간다 */
export const MANUAL_GAP_MS = 60 * 60 * 1000
export function canCallNow(last: RefillState | null, now: number): boolean {
  return !last || !last.ok || now - last.at >= MANUAL_GAP_MS
}

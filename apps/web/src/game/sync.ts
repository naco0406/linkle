import { kstDate } from '@linkle/core'
import { ADMIN_RUN_PREFIX } from './admin'
import { ApiError, finishRun, getToday } from './api'
import { allRuns, now, useGame } from './store'

// 서버와 맞추는 일 두 가지를 화면 밖에서 맡는다.
//   1. 끝난 판을 서버에 알린다. 결과 화면은 이 제출을 기다리지 않는다.
//   2. 오늘이 며칠인지 서버에 다시 묻는다. 탭을 열어 둔 채 자정을 넘긴 경우를 잡는다.

/** 이모지 계산을 기다려 주는 시간. 이모지는 표시용이라 늦으면 없이 보낸다 */
const EMOJI_WAIT_MS = 3_000
/** 탭을 오갈 때마다 묻지 않도록 두는 간격. Worker 요청 수는 하루 한도가 있다 */
const TODAY_INTERVAL_MS = 60_000

let sending: string | null = null
let emojiTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 끝났지만 아직 서버에 알리지 못한 판을 제출한다.
 * 실패하면 그대로 두고, 다음에 앱을 열거나 탭으로 돌아왔을 때 다시 보낸다.
 */
export async function flushOutbox(waitForEmoji: boolean): Promise<void> {
  // 오늘의 문제부터, 그다음 지난 문제·커뮤니티 판
  const run = allRuns(useGame.getState()).find(r => r.phase === 'finished' && r.outbox === 'pending' && sending !== r.runId && !r.runId.startsWith(ADMIN_RUN_PREFIX))
  if (!run) return
  if (!run.emoji && waitForEmoji) {
    emojiTimer ??= setTimeout(() => {
      emojiTimer = undefined
      void flushOutbox(false)
    }, EMOJI_WAIT_MS)
    return
  }
  clearTimeout(emojiTimer)
  emojiTimer = undefined

  sending = run.runId
  try {
    const { order, rank } = await finishRun(run)
    useGame.getState().settle(run.runId, order === null && rank == null ? null : { order, rank: rank ?? null })
  } catch (e) {
    // 서버가 받지 않는 판(예: 서버에 없는 판)은 다시 보내도 같으므로 그만둔다. 결과 화면은 순서 없이 그대로 보인다
    if (e instanceof ApiError && !e.retryable) useGame.getState().settle(run.runId, null)
  } finally {
    sending = null
  }
  // 보낼 판이 더 있으면 이어서 보낸다
  if (allRuns(useGame.getState()).some(r => r.phase === 'finished' && r.outbox === 'pending' && r.runId !== run.runId && !r.runId.startsWith(ADMIN_RUN_PREFIX))) void flushOutbox(false)
}

let checking = false
let checkedAt = 0

/** 서버의 오늘을 다시 받는다. 날짜가 바뀌었으면 store가 끝난 지난 판을 치운다 */
export async function refreshToday(): Promise<void> {
  const { today } = useGame.getState()
  // 방금 확인했고 기기 시계로도 같은 날이면 건너뛴다
  if (checking || (today && Date.now() - checkedAt < TODAY_INTERVAL_MS && kstDate(now()) === today.date)) return
  checking = true
  try {
    useGame.getState().setToday(await getToday())
    checkedAt = Date.now()
  } catch (e) {
    // 서버에 닿지 못해도 진행 중인 판은 영향이 없다. 다음 기회에 다시 묻는다
    if (e instanceof ApiError && e.code === 'no_puzzle') useGame.setState({ noPuzzle: true })
  } finally {
    checking = false
  }
}

/** 앱을 열 때 한 번 부른다 */
export function startSync(): void {
  const wake = () => {
    if (document.visibilityState !== 'visible') return
    // 제출을 먼저 보낸다. 날짜가 바뀌어 지난 판을 치우더라도 그 전에 기록이 서버로 떠난다
    void flushOutbox(false)
    void refreshToday()
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener('pageshow', wake)
  window.addEventListener('online', wake)

  // 판이 끝나는 순간(또는 이모지가 계산된 순간) 바로 제출한다
  useGame.subscribe(state => {
    if (allRuns(state).some(r => r.outbox === 'pending')) void flushOutbox(true)
  })

  wake()
}

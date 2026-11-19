import { kstDate, nextKstMidnight } from '@linkle/core'
import { findDaily, findPuzzle, findRunForFinish, saveFinish, startRun } from './db.ts'
import { HttpError, json, readJson } from './http.ts'
import { toPublic } from './daily.ts'
import { dailyJob, ensureStats, yesterdayOf } from './job.ts'
import { runKindFor, settle } from './rules.ts'
import { fillUpcoming } from './schedule.ts'
import { isUuid, LIMITS, parseFinishBody, parseStartBody, type Parsed } from './validate.ts'
import { wikiApi } from './verify.ts'

interface Env {
  ASSETS: Fetcher
  DB: D1Database
  /** 위키백과에 보내는 User-Agent. 연락처를 넣으면 요청 제한이 넉넉해진다(설계 문서 4.1). 비우면 기본값 */
  WIKI_USER_AGENT?: string
}

const DEFAULT_USER_AGENT = 'Linkle-daily-check/1.0'

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await route(request, pathname, env)
    } catch (e) {
      if (e instanceof HttpError) return json(e.detail ? { error: e.code, detail: e.detail } : { error: e.code }, e.status)
      console.error(e)
      return json({ error: 'internal' }, 500)
    }
  },

  /**
   * 매시 5분(wrangler.jsonc의 crons):
   * 오늘·내일 문제를 대기열에서 채우고, 어제 것을 모으고 기록을 확인한다.
   * 한쪽이 실패해도 다른 쪽은 한다.
   */
  async scheduled(controller, env, ctx): Promise<void> {
    const api = wikiApi(env.WIKI_USER_AGENT || DEFAULT_USER_AGENT)
    const now = controller.scheduledTime
    const run = (name: string, job: Promise<string>) => job.then(r => console.log(`${name}: ${r}`)).catch(e => console.error(`${name} 실패`, e))
    ctx.waitUntil(Promise.all([run('puzzles', fillUpcoming(env.DB, api, now)), run('yesterday', dailyJob(env.DB, api, now))]))
  },
} satisfies ExportedHandler<Env>

const FINISH_PATH = /^\/api\/runs\/([^/]+)\/finish$/

/** 경로가 몇 개뿐이라 프레임워크 없이 직접 가른다 */
function route(request: Request, path: string, env: Env): Promise<Response> | Response {
  if (path === '/api/health') return json({ ok: true, serverNow: Date.now(), date: kstDate(Date.now()) })
  if (path === '/api/today') {
    allow(request, 'GET')
    return today(env)
  }
  if (path === '/api/yesterday') {
    allow(request, 'GET')
    return yesterday(env)
  }
  if (path === '/api/runs') {
    allow(request, 'POST')
    return start(request, env)
  }
  const finishing = FINISH_PATH.exec(path)
  if (finishing) {
    allow(request, 'POST')
    return finish(request, env, finishing[1]!)
  }
  throw new HttpError(404, 'not_found')
}

function allow(request: Request, method: string): void {
  if (request.method !== method) throw new HttpError(405, 'method_not_allowed')
}

function unwrap<T>(parsed: Parsed<T>): T {
  if (!parsed.ok) throw new HttpError(400, parsed.error)
  return parsed.value
}

/** 오늘의 문제 번호와 완료 인원. 출발·도착 문서는 여기서 나가지 않는다 */
async function today(env: Env): Promise<Response> {
  const date = kstDate(Date.now())
  const daily = await findDaily(env.DB, date)
  if (!daily) throw new HttpError(503, 'no_puzzle')
  // DB를 기다리는 동안 시간이 흘렀으므로 시각은 응답 직전에 다시 읽는다
  const serverNow = Date.now()
  return json({ date, number: daily.puzzle.number, resetsAt: nextKstMidnight(serverNow), serverNow, finishedCount: daily.clears })
}

/** 어제의 기록. 모두에게 같은 내용이라 브라우저가 잠깐 들고 있게 한다 */
async function yesterday(env: Env): Promise<Response> {
  const now = Date.now()
  const date = yesterdayOf(now)
  const stats = await ensureStats(env.DB, date, now)
  if (stats === 'none') return json({ status: 'none', date }, 200, 'public, max-age=600')
  if (stats === 'pending') {
    const daily = await findDaily(env.DB, date)
    return json({ status: 'pending', date, number: daily?.puzzle.number ?? 0 }, 200, 'public, max-age=60')
  }
  return json(toPublic(stats), 200, stats.done ? 'public, max-age=600' : 'public, max-age=60')
}

/** 한 판을 시작한다. 출발·도착 문서가 나가는 유일한 곳이다 */
async function start(request: Request, env: Env): Promise<Response> {
  const body = unwrap(parseStartBody(await readJson(request, LIMITS.bodyBytes)))
  const now = Date.now()
  const date = kstDate(now)
  const stored = body.puzzleId === null ? await findDaily(env.DB, date) : await findPuzzle(env.DB, body.puzzleId)
  if (!stored) throw body.puzzleId === null ? new HttpError(503, 'no_puzzle') : new HttpError(404, 'puzzle_not_found')
  const kind = runKindFor({ kind: stored.puzzle.kind, date: stored.puzzle.date, status: stored.status, authorId: stored.authorId }, date, body.playerId)
  if (!kind) throw new HttpError(404, 'puzzle_not_found')

  const run = await startRun(env.DB, { puzzleId: stored.puzzle.id, playerId: body.playerId, kind, now })
  return json({ runId: run.runId, startedAt: run.startedAt, serverNow: Date.now(), mode: kind.mode, puzzle: stored.puzzle })
}

/** 완료 제출. 같은 Run을 다시 제출하면 처음 저장한 결과를 돌려준다 */
async function finish(request: Request, env: Env, runId: string): Promise<Response> {
  if (!isUuid(runId)) throw new HttpError(404, 'run_not_found')
  const body = unwrap(parseFinishBody(await readJson(request, LIMITS.bodyBytes)))
  const run = await findRunForFinish(env.DB, runId.toLowerCase())
  if (!run) throw new HttpError(404, 'run_not_found')
  if (run.playerId !== body.playerId) throw new HttpError(403, 'not_owner')
  if (run.finished) return json(run.finished)

  const now = Date.now()
  const settled = settle({ puzzle: run.puzzle, events: body.events, flags: body.flags, startedAt: run.startedAt, serverNow: now })
  if (!settled.ok) throw new HttpError(422, 'invalid_log', settled.reason)

  const saved = await saveFinish(env.DB, { runId: runId.toLowerCase(), now, settled: settled.value, events: body.events, emoji: body.emoji })
  if (!saved) throw new HttpError(404, 'run_not_found')
  return json(saved)
}

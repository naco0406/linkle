import { kstDate, nextKstMidnight } from '@linkle/core'
import { boardOf, findDaily, findPuzzle, findRunForFinish, listArchive, listCommunity, puzzleInfo, rankOf, saveFinish, startRun, type CommunitySort } from './db.ts'
import { HttpError, json, readJson } from './http.ts'
import { admin } from './admin.ts'
import { toPublic } from './daily.ts'
import { dailyJob, ensureStats, olderDayJob, verifyLeaders, yesterdayOf } from './job.ts'
import { runKindFor, settle } from './rules.ts'
import { fillUpcoming } from './schedule.ts'
import { isUuid, LIMITS, parseFinishBody, parseStartBody, type Parsed } from './validate.ts'
import { wikiApi } from './verify.ts'

interface Env {
  ASSETS: Fetcher
  DB: D1Database
  /** 위키백과에 보내는 User-Agent. 연락처를 넣으면 요청 제한이 넉넉해진다(설계 문서 4.1). 비우면 기본값 */
  WIKI_USER_AGENT?: string
  /** 관리용 API의 열쇠(admin.ts). wrangler secret으로 넣는다 */
  ADMIN_TOKEN?: string
  /** 관리자 화면 비밀번호. 사용자가 wrangler secret put으로 직접 정한다 */
  ADMIN_PASSWORD?: string
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
    ctx.waitUntil(
      Promise.all([
        run('puzzles', fillUpcoming(env.DB, api, now)),
        // 위키백과 요청이 몰리지 않게 기록 확인은 차례로 한다
        run('yesterday', dailyJob(env.DB, api, now))
          .then(() => run('older days', olderDayJob(env.DB, api, now)))
          .then(() => run('leaders', verifyLeaders(env.DB, api))),
      ]),
    )
  },
} satisfies ExportedHandler<Env>

const FINISH_PATH = /^\/api\/runs\/([^/]+)\/finish$/
const DAY_PATH = /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/
const PUZZLE_PATH = /^\/api\/puzzles\/(\d{1,9})(\/board)?$/

/** 경로가 몇 개뿐이라 프레임워크 없이 직접 가른다 */
function route(request: Request, path: string, env: Env): Promise<Response> | Response {
  if (path.startsWith('/api/admin/')) return admin(request, env, wikiApi(env.WIKI_USER_AGENT || DEFAULT_USER_AGENT), path)
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
  if (path === '/api/archive') {
    allow(request, 'GET')
    return archive(request, env)
  }
  if (path === '/api/community') {
    allow(request, 'GET')
    return community(request, env)
  }
  const day = DAY_PATH.exec(path)
  if (day) {
    allow(request, 'GET')
    return dayStats(env, day[1]!)
  }
  const puzzle = PUZZLE_PATH.exec(path)
  if (puzzle) {
    allow(request, 'GET')
    return puzzle[2] ? board(request, env, Number(puzzle[1])) : puzzleCard(env, Number(puzzle[1]))
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
  if (run.finished) return json(run.puzzle.kind === 'daily' ? run.finished : { ...run.finished, rank: await rankOf(env.DB, runId.toLowerCase()) })

  const now = Date.now()
  const settled = settle({ puzzle: run.puzzle, events: body.events, flags: body.flags, startedAt: run.startedAt, serverNow: now })
  if (!settled.ok) throw new HttpError(422, 'invalid_log', settled.reason)

  const saved = await saveFinish(env.DB, { runId: runId.toLowerCase(), now, settled: settled.value, events: body.events, emoji: body.emoji })
  if (!saved) throw new HttpError(404, 'run_not_found')
  // 커뮤니티 문제는 순위표의 자리도 알려 준다
  if (run.puzzle.kind !== 'daily') return json({ ...saved, rank: await rankOf(env.DB, runId.toLowerCase()) })
  return json(saved)
}

const PAGE = 30
const intParam = (url: URL, name: string): number | null => {
  const v = url.searchParams.get(name)
  return v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null
}

/** 지난 오늘의 문제 목록. 번호가 큰 것부터 30개씩 */
async function archive(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const items = await listArchive(env.DB, kstDate(Date.now()), intParam(url, 'before'), PAGE)
  return json({ items, next: items.length === PAGE ? items.at(-1)!.number : null }, 200, 'public, max-age=60')
}

/** 그날의 기록. 어제의 기록과 같은 모양이고, 지난 문제를 푼 뒤 나란히 보여 준다 */
async function dayStats(env: Env, date: string): Promise<Response> {
  const now = Date.now()
  if (date >= kstDate(now)) throw new HttpError(404, 'not_yet')
  const stats = await ensureStats(env.DB, date, now)
  if (stats === 'none') return json({ status: 'none', date }, 200, 'public, max-age=600')
  if (stats === 'pending') return json({ status: 'pending', date, number: (await findDaily(env.DB, date))?.puzzle.number ?? 0 }, 200, 'public, max-age=60')
  return json(toPublic(stats), 200, stats.done ? 'public, max-age=600' : 'public, max-age=60')
}

const SORTS: CommunitySort[] = ['new', 'popular', 'hard']

/** 커뮤니티 문제 목록 */
async function community(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const sort = SORTS.find(s => s === url.searchParams.get('sort')) ?? 'new'
  const offset = Math.min(intParam(url, 'offset') ?? 0, 3000)
  const items = await listCommunity(env.DB, sort, offset, PAGE)
  return json({ items, next: items.length === PAGE ? offset + PAGE : null }, 200, 'public, max-age=30')
}

/** 문제 하나의 카드. 오늘과 앞으로의 오늘의 문제는 없는 것으로 다룬다(출발·도착이 미리 새지 않게) */
async function puzzleCard(env: Env, id: number): Promise<Response> {
  const info = await puzzleInfo(env.DB, id)
  if (!info || (info.kind === 'daily' && (!info.date || info.date >= kstDate(Date.now())))) throw new HttpError(404, 'puzzle_not_found')
  return json(info, 200, 'public, max-age=30')
}

/** 문제별 순위표. playerId를 주면 내 자리도 함께 */
async function board(request: Request, env: Env, id: number): Promise<Response> {
  const player = new URL(request.url).searchParams.get('playerId')
  const info = await puzzleInfo(env.DB, id)
  if (!info || info.kind === 'daily') throw new HttpError(404, 'puzzle_not_found')
  return json(await boardOf(env.DB, id, isUuid(player) ? player.toLowerCase() : null, 20))
}

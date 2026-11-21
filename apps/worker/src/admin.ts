import { addDays, kstDate, RECENT_DAYS } from '@linkle/core'
import { HttpError, json, readJson } from './http.ts'
import { canCallNow, dispatchRefill, queueLeft, readRefill, REFILL_BELOW, type RefillState } from './refill.ts'
import { fillUpcoming } from './schedule.ts'
import type { WikiApi } from './verify.ts'

// 관리용 API.
//   문제 채우기(GitHub Actions)는 Authorization: Bearer <ADMIN_TOKEN>으로 부른다.
//   관리자 화면(/admin)은 비밀번호(ADMIN_PASSWORD)로 들어와 서명한 쿠키로 부른다.
// Cloudflare API 토큰을 저장소에 두지 않으려고 만들었다. 할 수 있는 일은 문제를 넣고, 빼고, 순서를 바꾸고, 숨기는 것뿐이다.

export type AdminEnv = { DB: D1Database; ADMIN_TOKEN?: string; ADMIN_PASSWORD?: string; GITHUB_DISPATCH_TOKEN?: string }

const COOKIE = 'linkle_admin'
const SESSION_DAYS = 30

/** 길이가 같으면 끝까지 비교한다. 앞 글자가 맞는 만큼 응답이 늦어지는 것을 막는다 */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 세션 쿠키: "만료시각.서명". 서명 열쇠는 ADMIN_TOKEN과 비밀번호를 합친 것이라,
 * 둘 중 하나를 바꾸면 이전에 받은 쿠키가 모두 무효가 된다.
 */
async function sessionValue(env: AdminEnv, expires: number): Promise<string> {
  return `${expires}.${await hmac(`${env.ADMIN_TOKEN}:${env.ADMIN_PASSWORD}`, `admin:${expires}`)}`
}

async function hasSession(request: Request, env: AdminEnv): Promise<boolean> {
  if (!env.ADMIN_TOKEN || !env.ADMIN_PASSWORD) return false
  const cookie = request.headers.get('cookie') ?? ''
  const value = cookie.split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!value) return false
  const expires = Number(value.split('.')[0])
  if (!Number.isFinite(expires) || expires < Date.now()) return false
  return sameSecret(value, await sessionValue(env, expires))
}

async function authorize(request: Request, env: AdminEnv): Promise<void> {
  const token = env.ADMIN_TOKEN
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  // 열쇠가 설정되지 않았으면 아무도 들어오지 못한다
  if (token && token.length >= 32 && given && sameSecret(given, token)) return
  if (await hasSession(request, env)) return
  throw new HttpError(401, 'unauthorized')
}

const cookieHeader = (value: string, maxAge: number) => `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`

async function login(request: Request, env: AdminEnv): Promise<Response> {
  if (!env.ADMIN_TOKEN || !env.ADMIN_PASSWORD) throw new HttpError(503, 'no_password')
  const body = (await readJson(request, 1024)) as { password?: unknown }
  const ok = typeof body.password === 'string' && sameSecret(body.password, env.ADMIN_PASSWORD)
  if (!ok) {
    // 틀리면 조금 늦게 답한다. 비밀번호를 빠르게 대입해 보는 것을 늦춘다
    await new Promise(r => setTimeout(r, 1000))
    throw new HttpError(401, 'wrong_password')
  }
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  const res = json({ ok: true })
  res.headers.append('set-cookie', cookieHeader(await sessionValue(env, expires), SESSION_DAYS * 86_400))
  return res
}

function logout(): Response {
  const res = json({ ok: true })
  res.headers.append('set-cookie', cookieHeader('', 0))
  return res
}

type Hop = { id: number; title: string; via: string }
export type AdminItem = { start: { id: number; title: string }; end: { id: number; title: string }; par: number; difficulty: string; solution: Hop[] }

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < 2 ** 31
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255
const isPage = (v: unknown): v is { id: number; title: string } => !!v && typeof v === 'object' && isId((v as { id: unknown }).id) && isTitle((v as { title: unknown }).title)

/** 문제 생성 도구나 관리자 화면이 보낸 후보 하나를 확인하고 필요한 칸만 남긴다 */
export function parseItem(raw: unknown): AdminItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isPage(r.start) || !isPage(r.end) || r.start.id === r.end.id) return null
  if (!Number.isInteger(r.par) || (r.par as number) < 1 || (r.par as number) > 30) return null
  if (!['easy', 'normal', 'hard'].includes(r.difficulty as string)) return null
  if (!Array.isArray(r.solution) || r.solution.length === 0 || r.solution.length > 30) return null
  const solution: Hop[] = []
  for (const h of r.solution as unknown[]) {
    const via = (h as { via?: unknown } | null)?.via
    if (!isPage(h) || !isTitle(via)) return null
    solution.push({ id: h.id, title: h.title, via })
  }
  if (solution.at(-1)!.id !== r.end.id) return null
  return { start: { id: r.start.id, title: r.start.title }, end: { id: r.end.id, title: r.end.title }, par: r.par as number, difficulty: r.difficulty as string, solution }
}

/** 이미 대기열이나 문제에 쓴 출발·도착 제목. 문제 생성 도구가 겹치지 않게 고르는 데 쓴다 */
async function usedTitles(env: AdminEnv): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT start_title AS t FROM puzzles UNION SELECT end_title FROM puzzles UNION SELECT start_title FROM puzzle_queue UNION SELECT end_title FROM puzzle_queue`,
  ).all<{ t: string }>()
  return json({ titles: results.map(r => r.t) })
}

/**
 * 후보를 넣는다. daily는 오늘의 문제 대기열로, official은 커뮤니티의 "링클이 낸 문제"로 바로 공개한다.
 * 같은 출발·도착 쌍은 한 번만 들어간다. first가 참이면 대기열 맨 앞에 둔다(관리자가 직접 넣은 문제).
 */
async function addPuzzles(request: Request, env: AdminEnv): Promise<Response> {
  const body = (await readJson(request, 256 * 1024)) as { pool?: unknown; items?: unknown; first?: unknown; reviewed?: unknown }
  const pool = body.pool === 'official' ? 'official' : body.pool === 'daily' ? 'daily' : null
  if (!pool || !Array.isArray(body.items) || body.items.length > 100) throw new HttpError(400, 'invalid_body')
  const items = body.items.map(parseItem)
  if (items.some(i => i === null)) throw new HttpError(400, 'invalid_item')
  const now = Date.now()
  const priority = body.first === true ? Math.floor(now / 1000) : 0
  // 관리자 화면에서 직접 풀어 넣은 문제는 이미 본 문제다. 문제 채우기로 들어온 것은 안 본 문제로 남는다
  const reviewed = body.reviewed === true ? now : null
  const statements = (items as AdminItem[]).map(c =>
    pool === 'daily'
      ? env.DB.prepare(
          `INSERT OR IGNORE INTO puzzle_queue (start_id, start_title, end_id, end_title, par, difficulty, solution, status, pool, created_at, priority, reviewed_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'approved', 'daily', ?8, ?9, ?10)`,
        ).bind(c.start.id, c.start.title, c.end.id, c.end.title, c.par, c.difficulty, JSON.stringify(c.solution), now, priority, reviewed)
      : env.DB.prepare(
          `INSERT OR IGNORE INTO puzzles (kind, number, start_id, start_title, end_id, end_title, par, difficulty, solution, status, created_at)
           SELECT 'official', COALESCE(MAX(number), 0) + 1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'published', ?8 FROM puzzles WHERE kind = 'official'`,
        ).bind(c.start.id, c.start.title, c.end.id, c.end.title, c.par, c.difficulty, JSON.stringify(c.solution), now),
  )
  const results = statements.length ? await env.DB.batch(statements) : []
  const added = results.reduce((n, r) => n + (r.meta.changes ?? 0), 0)
  const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM puzzle_queue WHERE status = 'approved' AND pool = 'daily'`).first<{ n: number }>()
  return json({ pool, received: items.length, added, queue: left?.n ?? 0 })
}

/** 한눈에: 최근 14일과 내일의 오늘의 문제, 대기열의 난이도별 수와 안 본 문제 수 */
async function overview(env: AdminEnv): Promise<Response> {
  const today = kstDate(Date.now())
  const [days, queue, community, players, refill] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, date, number, start_title, end_title, difficulty, par, plays, clears, solution FROM puzzles
       WHERE kind = 'daily' AND date >= ?1 ORDER BY date LIMIT 20`,
    ).bind(addDays(today, -13)),
    env.DB.prepare(
      `SELECT difficulty, COUNT(*) AS n, SUM(reviewed_at IS NULL) AS unreviewed FROM puzzle_queue WHERE status = 'approved' AND pool = 'daily' GROUP BY difficulty`,
    ),
    env.DB.prepare(`SELECT COUNT(*) AS n, SUM(plays) AS plays, SUM(clears) AS clears FROM puzzles WHERE kind = 'official' AND status = 'published'`),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM players`),
    env.DB.prepare(`SELECT value FROM job_state WHERE key = 'refill'`),
  ])
  const last = (refill?.results[0] as { value: string } | undefined)?.value
  return json({
    today,
    days: days?.results ?? [],
    queue: queue?.results ?? [],
    community: community?.results[0] ?? null,
    players: (players?.results[0] as { n: number } | undefined)?.n ?? 0,
    // 문제 채우기를 마지막으로 부른 결과와, 부를 열쇠가 있는지(값은 내보내지 않는다)
    refill: { last: last ? (JSON.parse(last) as RefillState) : null, below: REFILL_BELOW, canDispatch: Boolean(env.GITHUB_DISPATCH_TOKEN) },
  })
}

/** "지금 채우기": 대기열 수와 상관없이 문제 채우기(GitHub Actions)를 부른다. 토큰이 맞는지 확인할 때도 쓴다 */
async function refillNow(env: AdminEnv): Promise<Response> {
  if (!env.GITHUB_DISPATCH_TOKEN) throw new HttpError(409, 'no_token')
  const now = Date.now()
  const [left, last] = await Promise.all([queueLeft(env.DB), readRefill(env.DB)])
  if (!canCallNow(last, now)) throw new HttpError(409, 'recent')
  // GitHub가 거절해도 200으로 답하고 그 상태를 그대로 알려 준다(토큰 권한 확인용)
  return json(await dispatchRefill(env.DB, env.GITHUB_DISPATCH_TOKEN, now, left))
}

/**
 * 대기열. 낼 순서대로(당긴 것 먼저, 그다음 들어온 순서), 뺀 문제도 최근 것 몇 개.
 * placed는 최근 30일과 앞으로 날짜가 붙은 오늘의 문제다. 화면이 이것으로 앞으로의 일정을 계산한다(@linkle/core projectSchedule)
 */
async function queueList(env: AdminEnv): Promise<Response> {
  const today = kstDate(Date.now())
  const [approved, rejected, placed] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, start_id, start_title, end_id, end_title, par, difficulty, solution, priority, created_at, reviewed_at FROM puzzle_queue
       WHERE status = 'approved' AND pool = 'daily' ORDER BY priority DESC, id`,
    ),
    env.DB.prepare(`SELECT id, start_title, end_title, par, difficulty, note FROM puzzle_queue WHERE status = 'rejected' ORDER BY id DESC LIMIT 20`),
    env.DB.prepare(
      `SELECT id, date, number, start_id, start_title, end_id, end_title, difficulty, par, plays, solution FROM puzzles WHERE kind = 'daily' AND date >= ?1 ORDER BY date`,
    ).bind(addDays(today, -RECENT_DAYS)),
  ])
  return json({ today, approved: approved?.results ?? [], rejected: rejected?.results ?? [], placed: placed?.results ?? [] })
}

async function queueAction(request: Request, env: AdminEnv, id: number): Promise<Response> {
  const { action } = (await readJson(request, 1024)) as { action?: unknown }
  const sql: Record<string, string> = {
    reject: `UPDATE puzzle_queue SET status = 'rejected', note = '관리자가 뺌' WHERE id = ?1 AND status = 'approved'`,
    restore: `UPDATE puzzle_queue SET status = 'approved', note = NULL, priority = 0 WHERE id = ?1 AND status = 'rejected'`,
    first: `UPDATE puzzle_queue SET priority = ?2 WHERE id = ?1 AND status = 'approved'`,
    unpin: `UPDATE puzzle_queue SET priority = 0 WHERE id = ?1`,
    // 훑어보기: 봤다고 남긴다. 되돌리기(unreview)는 실수로 누른 것을 다시 안 본 문제로 돌린다
    ok: `UPDATE puzzle_queue SET reviewed_at = ?2 WHERE id = ?1 AND status = 'approved'`,
    unreview: `UPDATE puzzle_queue SET reviewed_at = NULL WHERE id = ?1`,
  }
  const q = typeof action === 'string' ? sql[action] : undefined
  if (!q) throw new HttpError(400, 'invalid_action')
  const stmt = env.DB.prepare(q)
  const r = await (action === 'first' ? stmt.bind(id, Math.floor(Date.now() / 1000)) : action === 'ok' ? stmt.bind(id, Date.now()) : stmt.bind(id)).run()
  if (!r.meta.changes) throw new HttpError(409, 'no_change')
  return json({ ok: true })
}

/** 커뮤니티의 링클이 낸 문제. 숨긴 것도 함께 */
async function communityList(env: AdminEnv): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, number, start_title, end_title, par, difficulty, status, plays, clears, solution FROM puzzles WHERE kind IN ('official', 'community') ORDER BY id DESC`,
  ).all()
  return json({ items: results })
}

/**
 * 문제에 하는 일.
 *   hide / show: 커뮤니티 문제를 목록에서 숨기거나 다시 보인다(순위표 기록은 남는다)
 *   replace: 아직 오지 않은 날의 오늘의 문제를 대기열의 다음 문제로 바꾼다. 아무도 시작하지 않은 날만 된다
 */
async function puzzleAction(request: Request, env: AdminEnv, api: WikiApi, id: number): Promise<Response> {
  const { action } = (await readJson(request, 1024)) as { action?: unknown }
  if (action === 'hide' || action === 'show') {
    const r = await env.DB.prepare(`UPDATE puzzles SET status = ?2 WHERE id = ?1 AND kind != 'daily'`).bind(id, action === 'hide' ? 'hidden' : 'published').run()
    if (!r.meta.changes) throw new HttpError(409, 'no_change')
    return json({ ok: true })
  }
  if (action === 'replace') {
    const row = await env.DB.prepare(`SELECT *, (SELECT COUNT(*) FROM runs WHERE puzzle_id = ?1) AS run_count FROM puzzles WHERE id = ?1 AND kind = 'daily'`)
      .bind(id)
      .first<Record<string, unknown> & { date: string; start_id: number; end_id: number; run_count: number }>()
    if (!row) throw new HttpError(404, 'puzzle_not_found')
    if (row.date <= kstDate(Date.now()) || row.run_count > 0) throw new HttpError(409, 'already_open')
    const { run_count: _, ...original } = row
    const unmark = env.DB.prepare(`UPDATE puzzle_queue SET status = 'rejected', note = '관리자가 바꿈' WHERE start_id = ?1 AND end_id = ?2 AND status != 'rejected'`).bind(row.start_id, row.end_id)
    // 지운 문제는 대기열에서도 빼서 다시 나오지 않게 한다
    const [, marked] = await env.DB.batch([env.DB.prepare(`DELETE FROM puzzles WHERE id = ?1`).bind(id), unmark])
    const result = await fillUpcoming(env.DB, api, Date.now())
    const filled = await env.DB.prepare(`SELECT id FROM puzzles WHERE kind = 'daily' AND date = ?1`).bind(row.date).first()
    if (!filled) {
      // 바꿀 문제가 없으면 그날을 비워 두지 않고 원래 문제를 되살린다
      const cols = Object.keys(original)
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO puzzles (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...cols.map(c => original[c] ?? null)),
        ...(marked?.meta.changes
          ? [env.DB.prepare(`UPDATE puzzle_queue SET status = 'used', note = ?3 WHERE start_id = ?1 AND end_id = ?2`).bind(row.start_id, row.end_id, row.date)]
          : []),
      ])
      throw new HttpError(409, 'no_replacement')
    }
    return json({ ok: true, result })
  }
  throw new HttpError(400, 'invalid_action')
}

const QUEUE_PATH = /^\/api\/admin\/queue\/(\d{1,9})$/
const PUZZLE_PATH = /^\/api\/admin\/puzzles\/(\d{1,9})$/

export async function admin(request: Request, env: AdminEnv, api: WikiApi, path: string): Promise<Response> {
  const m = request.method
  if (path === '/api/admin/login' && m === 'POST') return login(request, env)
  if (path === '/api/admin/logout' && m === 'POST') return logout()
  await authorize(request, env)
  if (path === '/api/admin/me' && m === 'GET') return json({ ok: true })
  if (path === '/api/admin/used' && m === 'GET') return usedTitles(env)
  if (path === '/api/admin/puzzles' && m === 'POST') return addPuzzles(request, env)
  if (path === '/api/admin/overview' && m === 'GET') return overview(env)
  if (path === '/api/admin/queue' && m === 'GET') return queueList(env)
  if (path === '/api/admin/community' && m === 'GET') return communityList(env)
  if (path === '/api/admin/refill' && m === 'POST') return refillNow(env)
  const q = QUEUE_PATH.exec(path)
  if (q && m === 'POST') return queueAction(request, env, Number(q[1]))
  const p = PUZZLE_PATH.exec(path)
  if (p && m === 'POST') return puzzleAction(request, env, api, Number(p[1]))
  throw new HttpError(404, 'not_found')
}

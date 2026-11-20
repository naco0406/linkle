import { HttpError, json, readJson } from './http.ts'

// 문제 채우기(GitHub Actions)가 부르는 관리용 API.
// Cloudflare API 토큰을 저장소에 두지 않으려고 만들었다. 이 API로는 문제를 넣는 것과 이미 쓴 제목을 읽는 것만 할 수 있다.
// 열쇠는 Worker 비밀값 ADMIN_TOKEN과 저장소 비밀값 LINKLE_ADMIN_TOKEN에 같은 값으로 둔다.

export type AdminEnv = { DB: D1Database; ADMIN_TOKEN?: string }

/** 길이가 같으면 끝까지 비교한다. 앞 글자가 맞는 만큼 응답이 늦어지는 것을 막는다 */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

function authorize(request: Request, env: AdminEnv): void {
  const token = env.ADMIN_TOKEN
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  // 열쇠가 설정되지 않았으면 아무도 들어오지 못한다
  if (!token || token.length < 32 || !sameSecret(given, token)) throw new HttpError(401, 'unauthorized')
}

type Hop = { id: number; title: string; via: string }
export type AdminItem = { start: { id: number; title: string }; end: { id: number; title: string }; par: number; difficulty: string; solution: Hop[] }

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < 2 ** 31
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255
const isPage = (v: unknown): v is { id: number; title: string } => !!v && typeof v === 'object' && isId((v as { id: unknown }).id) && isTitle((v as { title: unknown }).title)

/** 문제 생성 도구가 만든 후보 하나를 확인하고 필요한 칸만 남긴다 */
export function parseItem(raw: unknown): AdminItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isPage(r.start) || !isPage(r.end) || r.start.id === r.end.id) return null
  if (!Number.isInteger(r.par) || (r.par as number) < 1 || (r.par as number) > 10) return null
  if (!['easy', 'normal', 'hard'].includes(r.difficulty as string)) return null
  if (!Array.isArray(r.solution) || r.solution.length === 0 || r.solution.length > 10) return null
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
 * 같은 출발·도착 쌍은 한 번만 들어간다.
 */
async function addPuzzles(request: Request, env: AdminEnv): Promise<Response> {
  const body = (await readJson(request, 256 * 1024)) as { pool?: unknown; items?: unknown }
  const pool = body.pool === 'official' ? 'official' : body.pool === 'daily' ? 'daily' : null
  if (!pool || !Array.isArray(body.items) || body.items.length > 100) throw new HttpError(400, 'invalid_body')
  const items = body.items.map(parseItem)
  if (items.some(i => i === null)) throw new HttpError(400, 'invalid_item')
  const now = Date.now()
  const statements = (items as AdminItem[]).map(c =>
    pool === 'daily'
      ? env.DB.prepare(
          `INSERT OR IGNORE INTO puzzle_queue (start_id, start_title, end_id, end_title, par, difficulty, solution, status, pool, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'approved', 'daily', ?8)`,
        ).bind(c.start.id, c.start.title, c.end.id, c.end.title, c.par, c.difficulty, JSON.stringify(c.solution), now)
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

export function admin(request: Request, env: AdminEnv, path: string): Promise<Response> {
  authorize(request, env)
  if (path === '/api/admin/used' && request.method === 'GET') return usedTitles(env)
  if (path === '/api/admin/puzzles' && request.method === 'POST') return addPuzzles(request, env)
  throw new HttpError(404, 'not_found')
}

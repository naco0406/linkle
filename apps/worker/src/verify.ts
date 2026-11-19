import type { MoveEvent, Page } from '@linkle/core'

/**
 * 기록의 경로가 실제 위키백과의 링크로 이어지는지 확인한다.
 *
 * 문서 HTML을 받아 정리 규칙까지 적용하면 "게임에서 누를 수 있었던 링크"인지까지 알 수 있지만,
 * Worker 무료 요금제의 CPU 10 ms 안에 문서 파싱이 들어가지 않는다(설계 문서 14.3).
 * 그래서 MediaWiki API로 두 가지만 본다. 둘 다 작은 JSON이라 파싱이 가볍다.
 *   1. 출발 문서가 누른 제목으로 가는 링크를 갖고 있는가 (prop=links&pltitles=)
 *   2. 누른 제목이 넘겨주기를 거쳐 기록된 도착 문서로 가는가 (titles=&redirects=)
 * 지어낸 경로는 여기서 걸린다. 탐색 상자처럼 게임에서는 지운 링크를 탔다고 우기는 경우는 못 거른다.
 */

/** MediaWiki API 한 번 부르기. 응답 JSON을 돌려준다. 받지 못하면 WikiUnavailable을 던진다 */
export type WikiApi = (params: Record<string, string>) => Promise<unknown>

/** 위키백과에 닿지 못했다(요청 제한, 네트워크). 기록이 틀린 것이 아니므로 다음에 다시 확인한다 */
export class WikiUnavailable extends Error {}

export type Verdict = { ok: true } | { ok: false; reason: string }

/** 위키백과가 제목을 저장하는 꼴로 맞춘다: 밑줄은 띄어쓰기, 첫 글자는 대문자 */
export function normalizeTitle(title: string): string {
  const t = title.replaceAll('_', ' ').replace(/\s+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

type Hop = { from: number; via: string; to: number }

/** 로그에서 링크 이동만 뽑는다. 뒤로가기는 앞서 로그 검사(checkLog)가 확인했다 */
export function hopsOf(start: Page, events: readonly MoveEvent[]): Hop[] {
  const stack: number[] = [start.id]
  const hops: Hop[] = []
  for (const e of events) {
    if (e.type === 'back') {
      if (stack.length > 1) stack.pop()
      continue
    }
    hops.push({ from: stack.at(-1)!, via: normalizeTitle(e.via), to: e.to.id })
    stack.push(e.to.id)
  }
  return hops
}

/** 한 번에 물을 수 있는 제목 수. API의 상한(50)보다 조금 낮게 잡았다 */
const CHUNK = 40

export async function verifyPath(start: Page, events: readonly MoveEvent[], api: WikiApi): Promise<Verdict> {
  const hops = hopsOf(start, events)
  if (hops.length === 0) return { ok: false, reason: 'no_links' }
  for (let i = 0; i < hops.length; i += CHUNK) {
    const chunk = hops.slice(i, i + CHUNK)
    const linked = await linksAmong(chunk, api)
    const target = await resolveTitles([...new Set(chunk.map(h => h.via))], api)
    for (const [k, h] of chunk.entries()) {
      if (!linked.has(`${h.from}\n${h.via}`)) return { ok: false, reason: `no_link@${i + k}` }
      if (target.get(h.via) !== h.to) return { ok: false, reason: `wrong_target@${i + k}` }
    }
  }
  return { ok: true }
}

type LinksResponse = {
  continue?: Record<string, string>
  query?: { pages?: { pageid?: number; links?: { title: string }[] }[] }
}

/** 각 출발 문서가 가진 링크 중 누른 제목들에 해당하는 것. "문서id\n제목" 꼴의 집합 */
async function linksAmong(hops: Hop[], api: WikiApi): Promise<Set<string>> {
  const found = new Set<string>()
  const base = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'links',
    pageids: [...new Set(hops.map(h => h.from))].join('|'),
    pltitles: [...new Set(hops.map(h => h.via))].join('|'),
    pllimit: 'max',
  }
  let more: Record<string, string> = {}
  // 결과는 누른 제목으로 걸러져 작다. 이어받기가 생겨도 몇 번이면 끝난다
  for (let round = 0; round < 5; round++) {
    const res = (await api({ ...base, ...more })) as LinksResponse
    for (const page of res.query?.pages ?? []) {
      for (const link of page.links ?? []) found.add(`${page.pageid}\n${normalizeTitle(link.title)}`)
    }
    if (!res.continue) break
    more = res.continue
  }
  return found
}

type TitlesResponse = {
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: { pageid?: number; title: string; missing?: boolean }[]
  }
}

/** 제목 → 넘겨주기를 거친 최종 문서 id. 없는 문서는 빠진다 */
export async function resolveTitles(titles: string[], api: WikiApi): Promise<Map<string, number>> {
  const res = (await api({ action: 'query', format: 'json', formatversion: '2', redirects: '1', titles: titles.join('|') })) as TitlesResponse
  const q = res.query ?? {}
  const step = (pairs: { from: string; to: string }[] | undefined) => new Map((pairs ?? []).map(p => [normalizeTitle(p.from), normalizeTitle(p.to)]))
  const normalized = step(q.normalized)
  const redirects = step(q.redirects)
  const ids = new Map((q.pages ?? []).filter(p => !p.missing && p.pageid).map(p => [normalizeTitle(p.title), p.pageid!]))
  const out = new Map<string, number>()
  for (const title of titles) {
    let t = normalized.get(title) ?? title
    // 넘겨주기가 두 번 이어진 경우까지 따라간다
    for (let hop = 0; hop < 3 && redirects.has(t); hop++) t = redirects.get(t)!
    const id = ids.get(t)
    if (id !== undefined) out.set(title, id)
  }
  return out
}

/** Worker에서 쓰는 실제 API 호출. 요청 제한이나 서버 오류는 WikiUnavailable로 바꾼다 */
export function wikiApi(userAgent: string): WikiApi {
  return async params => {
    const url = `https://ko.wikipedia.org/w/api.php?${new URLSearchParams(params)}`
    let res: Response
    try {
      res = await fetch(url, { headers: { 'user-agent': userAgent, 'api-user-agent': userAgent } })
    } catch {
      throw new WikiUnavailable('network')
    }
    if (!res.ok) throw new WikiUnavailable(String(res.status))
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null
    if (!body || body.error) throw new WikiUnavailable('bad_response')
    return body
  }
}

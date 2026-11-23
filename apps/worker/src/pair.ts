import type { Page } from '@linkle/core'
import { titleProblem } from './friends.ts'
import { normalizeTitle, type WikiApi } from './verify.ts'

// 사람이 고른 출발·도착을 확인한다(설계 문서 12.2의 1번). MediaWiki API 한 번이라 Worker에서 해도 가볍다.
// 있는 문서인지, 일반 문서인지, 동음이의 문서가 아닌지, 넘겨주기면 원래 문서로 바꿔서.

type Raw = {
  query?: {
    redirects?: { from: string; to: string }[]
    pages?: { pageid?: number; ns: number; title: string; missing?: boolean; pageprops?: { disambiguation?: string } }[]
  }
}

export type PairCheck = { ok: true; start: Page; end: Page } | { ok: false; error: string }

export async function checkPair(api: WikiApi, start: Page, end: Page): Promise<PairCheck> {
  const res = (await api({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageprops',
    ppprop: 'disambiguation',
    pageids: `${start.id}|${end.id}`,
  })) as Raw
  const pages = new Map((res.query?.pages ?? []).map(p => [p.pageid, p]))
  const one = (want: Page): Page | string => {
    const p = pages.get(want.id)
    if (!p || p.missing) return 'missing'
    if (p.ns !== 0) return 'not_article'
    if (p.pageprops?.disambiguation !== undefined) return 'disambig'
    const problem = titleProblem(p.title)
    if (problem) return problem
    return { id: want.id, title: normalizeTitle(p.title) }
  }
  const s = one(start)
  const e = one(end)
  if (typeof s === 'string') return { ok: false, error: `start_${s}` }
  if (typeof e === 'string') return { ok: false, error: `end_${e}` }
  return { ok: true, start: s, end: e }
}

import type { Graph } from './graph.ts'
import { titleOk } from './pick.ts'
import type { Wiki } from './wiki.ts'

// 출발·도착으로 쓸 "많은 사람이 아는 문서"를 고른다.
// 링크가 많이 들어오는 문서만으로 고르면 탐색 상자에 줄줄이 걸린 학교·연도·선수가 섞인다(첫 실험에서 확인).
// 그래서 두 가지 신호를 쓴다: 위키백과가 정한 기본 문서 목록, 그리고 1년 동안 여러 달 조회수 상위에 든 문서.

const VITAL = '위키백과:모든 언어의 위키백과마다 꼭 있어야 하는 문서 목록'
const LIVING = '분류:살아있는 사람'

/** 기본 문서 목록(약 1000개). 백과사전이라면 꼭 있어야 하는 주제다 */
export async function vitalNodes(g: Graph, wiki: Wiki): Promise<Set<number>> {
  const out = new Set<number>()
  let more: Record<string, string> = {}
  for (let round = 0; round < 10; round++) {
    const res = (await wiki.api({ action: 'query', titles: VITAL, prop: 'links', plnamespace: '0', pllimit: 'max', ...more })) as {
      continue?: Record<string, string>
      query?: { pages?: { links?: { title: string }[] }[] }
    }
    for (const l of res.query?.pages?.[0]?.links ?? []) {
      const n = g.byTitle.get(l.title)
      if (n !== undefined) out.add(n)
    }
    if (!res.continue) break
    more = res.continue
  }
  return out
}

/**
 * 지난 months달 동안 매달 조회수 상위 1000에 든 횟수. minMonths번 이상 든 문서만.
 * 한 달만 반짝한 뉴스·사건 문서를 거르고, 꾸준히 찾는 문서를 남긴다.
 */
export async function popularNodes(g: Graph, wiki: Wiki, now: Date, months = 12, minMonths = 3): Promise<Set<number>> {
  const counts = new Map<number, number>()
  for (let k = 1; k <= months; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const res = (await wiki.rest(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ko.wikipedia.org/all-access/${y}/${m}/all-days`).catch(e => (console.warn(`  ${y}-${m} 조회수를 받지 못함: ${(e as Error).message}`), null))) as {
      items?: { articles: { article: string }[] }[]
    } | null
    for (const a of res?.items?.[0]?.articles ?? []) {
      const n = g.byTitle.get(a.article.replaceAll('_', ' '))
      if (n !== undefined) counts.set(n, (counts.get(n) ?? 0) + 1)
    }
  }
  return new Set([...counts].filter(([, c]) => c >= minMonths).map(([n]) => n))
}

/**
 * 살아 있는 사람의 문서. 출제하지 않는다.
 * 인물의 사생활·논란이 게임 소재가 되지 않게 하려는 것이다. 역사 속 인물(세종, 아이작 뉴턴)은 남는다.
 */
export async function livingPeople(g: Graph, wiki: Wiki, nodes: number[]): Promise<Set<number>> {
  const out = new Set<number>()
  for (let i = 0; i < nodes.length; i += 50) {
    const batch = nodes.slice(i, i + 50)
    const res = (await wiki.api({ action: 'query', prop: 'categories', clcategories: LIVING, cllimit: 'max', titles: batch.map(n => g.titles[n]).join('|') })) as {
      query?: { pages?: { title: string; categories?: unknown[] }[] }
    }
    for (const p of res.query?.pages ?? []) if (p.categories?.length) out.add(g.byTitle.get(p.title)!)
  }
  return out
}

/** 출발·도착 후보: (기본 문서 ∪ 꾸준히 인기 있는 문서) − 동음이의 − 제목 규칙 − 살아 있는 사람 */
export async function buildPool(g: Graph, wiki: Wiki, now: Date): Promise<{ pool: number[]; vital: number; popular: number; living: number }> {
  const vital = await vitalNodes(g, wiki)
  console.log(`  기본 문서 ${vital.size}개`)
  const popular = await popularNodes(g, wiki, now)
  console.log(`  꾸준히 인기 있는 문서 ${popular.size}개. 살아 있는 사람을 확인하는 중`)
  const base = [...new Set([...vital, ...popular])].filter(n => !g.disambig[n] && titleOk(g.titles[n]!))
  const living = await livingPeople(g, wiki, base)
  return { pool: base.filter(n => !living.has(n)), vital: vital.size, popular: popular.size, living: living.size }
}

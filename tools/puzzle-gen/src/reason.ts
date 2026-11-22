import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cosine, embed, loadModel, makeLead, score01, type EmbedModel, type ModelMeta } from '@linkle/embed'
import { bfs, loadGraph, type Graph } from './graph.ts'
import type { Hop } from './generate.ts'
import { BOOKKEEPING, unthinkable } from './pick.ts'
import { Wiki } from './wiki.ts'

/**
 * 추론 검사(설계 문서 7.3). 링크가 이어져 있다는 것만으로는 사람이 찾을 수 있는 문제인지 알 수 없다.
 *
 * A → B 문제에서 사람은 B와 뜻이 가까운 문서를 떠올려 그쪽으로 간다. 그러니 B로 들어오는 문(진입점) 중에
 * B와 뜻이 분명히 가까운 문서가 충분히 있어야 하고, 정답 길도 그런 문을 지나 B로 들어가야 한다.
 *
 *   2026-11-21 #2 내분비계 → 배롱나무: 들어오는 링크 107개 대부분이 그 나무를 교목으로 둔 학교와 시였다.
 *   "어느 학교의 교목일까"는 게임 밖에서 검색해야 아는 일이다. 뜻이 가까운 문은 6개(백일홍, 도금양목, 아열대 …)뿐이었고
 *   3명 모두 도착하지 못했다. 전날 #1 소화계 → 인상, 해돋이는 인상주의·클로드 모네 쪽 문이 18개가 넘었고 4명 중 2명이 도착했다.
 *
 * 검사:
 *   1. B로 들어오는 링크마다 첫 문단을 게임의 유사도 모델로 B의 첫 문단과 비교한다(0~1, 이모지와 같은 눈금)
 *      들어오는 링크가 많으면 제목이 가까운 순으로 BATCH개씩, 문이 MIN개 모일 때까지 LOOK개까지 본다.
 *      제목만으로는 순서가 거칠어서 첫 묶음만 보면 멀쩡한 문제가 "문이 모자람"으로 떨어진다
 *   2. SIM 이상인 문(뜻이 가까운 진입점)이 MIN개 이상이어야 한다
 *   3. A에서 그 문 중 하나를 지나 B까지 최단 거리 + SLACK번 안에, 게임에서 누를 수 있는 링크로 가는 길이 있어야 한다.
 *      길은 링크 지도에서 뽑지 않고 게임 문서에 남은 링크를 따라 찾는다(guidedPath). 지도에서 뽑은 길은 한 걸음만
 *      탐색 상자 링크여도 통째로 버려져, 문이 60개인 문제도 떨어졌다.
 *      언어·연도·표기처럼 뜻으로 떠올려 누르지 않는 문서는 지나가지 않는다(unthinkable)
 * 통과한 길을 정답 예시로 저장한다.
 * 기준값은 2026-11-21에 그때 있던 문제 80개로 맞췄다. 실제 도착률이 쌓이면 다시 맞춘다
 */
export const ENTRY = { sim: 0.7, min: 10, batch: 60, look: 180, slack: 1, width: 5, pages: 30 }

export type TitleVec = (node: number) => Float32Array

/** 노드 제목의 벡터(진입점을 미리 추릴 때만 쓴다). 한 번 만든 것은 다시 쓴다 */
export function titleVectors(g: Graph, model: EmbedModel): TitleVec {
  const cache = new Map<number, Float32Array>()
  return n => {
    let v = cache.get(n)
    if (!v) cache.set(n, (v = embed(model, g.titles[n]!)))
    return v
  }
}

/** 문서들의 첫 문단. 한 번 받은 것은 다시 받지 않는다 */
export class Leads {
  private readonly cache = new Map<string, string>()
  private readonly wiki: Wiki
  // node가 타입만 지우고 돌리므로 생성자 매개변수 속성(private readonly wiki)을 쓰지 않는다
  constructor(wiki: Wiki) {
    this.wiki = wiki
  }
  async get(titles: string[]): Promise<Map<string, string>> {
    const need = [...new Set(titles)].filter(t => !this.cache.has(t))
    for (let i = 0; i < need.length; i += 20) {
      const batch = need.slice(i, i + 20)
      const res = (await this.wiki.api({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', titles: batch.join('|') })) as {
        query?: { pages?: { title: string; extract?: string }[]; normalized?: { from: string; to: string }[] }
      }
      const norm = new Map((res.query?.normalized ?? []).map(n => [n.to, n.from]))
      for (const p of res.query?.pages ?? []) this.cache.set(norm.get(p.title) ?? p.title, p.extract ?? '')
      for (const t of batch) if (!this.cache.has(t)) this.cache.set(t, '')
    }
    return new Map(titles.map(t => [t, this.cache.get(t) ?? '']))
  }
}

export type Entry = { node: number; sim: number }

/** B로 들어오는 링크 중 B와 뜻이 가까운 문(ENTRY.sim 이상). 가까운 순 */
export async function relatedEntries(g: Graph, e: number, model: EmbedModel, leads: Leads, vec: TitleVec): Promise<{ target: Float32Array; entries: Entry[] }> {
  const title = g.titles[e]!
  let ins: number[] = []
  for (let i = g.inAt[e]!; i < g.inAt[e + 1]!; i++) if (!g.disambig[g.in[i]!]) ins.push(g.in[i]!)
  const target = embed(model, makeLead(title, (await leads.get([title])).get(title) ?? ''))
  if (ins.length > ENTRY.batch) ins = ins.map(n => [n, cosine(vec(n), target)] as const).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const entries: Entry[] = []
  for (let i = 0; i < Math.min(ins.length, ENTRY.look) && entries.length < ENTRY.min; i += ENTRY.batch) {
    const batch = ins.slice(i, i + ENTRY.batch)
    const got = await leads.get(batch.map(n => g.titles[n]!))
    for (const node of batch) {
      const sim = score01(model, embed(model, makeLead(g.titles[node]!, got.get(g.titles[node]!) ?? '')), target)
      if (sim >= ENTRY.sim) entries.push({ node, sim })
    }
  }
  return { target, entries: entries.sort((a, b) => b.sim - a.sim) }
}

/** 문까지 남은 거리(링크 지도, 하한). 지나가지 않을 문서는 건너지 않는다. 닿지 않으면 255 */
export function distanceToDoors(g: Pick<Graph, 'inAt' | 'in'>, doors: number[], maxDepth: number, skip: (n: number) => boolean): Uint8Array {
  const dist = new Uint8Array(g.inAt.length - 1).fill(255)
  for (const d of doors) dist[d] = 0
  let frontier = [...doors]
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: number[] = []
    for (const v of frontier) {
      for (let k = g.inAt[v]!; k < g.inAt[v + 1]!; k++) {
        const u = g.in[k]!
        if (dist[u] !== 255 || skip(u)) continue
        dist[u] = d
        next.push(u)
      }
    }
    frontier = next
  }
  return dist
}

/** 게임 문서에서 누를 수 있는 링크. 문서를 받지 못하면 null */
export type LinksOf = (node: number) => Promise<{ node: number; via: string }[] | null>

/**
 * 게임에 남은 링크만 따라, 문을 지나 도착까지 maxMoves번 안에 가는 길.
 * 문까지 가까운 링크부터, 같은 거리면 rank가 큰 링크부터 본다. 문서는 pages장까지만 받는다.
 */
export async function guidedPath(o: {
  start: number
  end: number
  maxMoves: number
  doors: Set<number>
  toDoor: Uint8Array
  linksOf: LinksOf
  skip: (n: number) => boolean
  rank: (n: number) => number
  width?: number
  pages?: number
}): Promise<{ node: number; via: string }[] | null> {
  const { width = ENTRY.width, pages = ENTRY.pages } = o
  const fetched = new Set<number>()
  const path: { node: number; via: string }[] = []
  const onPath = new Set([o.start])
  const visit = async (u: number): Promise<boolean> => {
    if (!fetched.has(u) && fetched.size >= pages) return false
    fetched.add(u)
    const links = await o.linksOf(u)
    if (!links) return false
    if (o.doors.has(u)) {
      const last = links.find(l => l.node === o.end)
      if (last) {
        path.push(last)
        return true
      }
    }
    const left = o.maxMoves - path.length
    const next = links
      // n으로 한 번, n에서 문까지, 문에서 도착으로 한 번
      .filter(l => l.node !== o.end && !onPath.has(l.node) && o.toDoor[l.node]! + 2 <= left && (o.doors.has(l.node) || !o.skip(l.node)))
      .map(l => ({ l, rank: o.rank(l.node) }))
      .sort((a, b) => o.toDoor[a.l.node]! - o.toDoor[b.l.node]! || b.rank - a.rank)
      .slice(0, width)
    for (const { l } of next) {
      path.push(l)
      onPath.add(l.node)
      if (await visit(l.node)) return true
      path.pop()
      onPath.delete(l.node)
    }
    return false
  }
  return (await visit(o.start)) ? path : null
}

export type Verdict = { ok: boolean; par: number; entries: number; entryTitles: string[]; hops: Hop[] | null; reason?: string }

/** 한 문제를 검사한다. 길은 게임과 같은 정리 규칙으로 받은 문서의 링크로만 찾는다 */
export async function checkReason(g: Graph, s: number, e: number, model: EmbedModel, leads: Leads, vec: TitleVec, wiki: Wiki): Promise<Verdict> {
  const par = bfs(g, s, 6).dist[e]!
  if (par === 255) return { ok: false, par: -1, entries: 0, entryTitles: [], hops: null, reason: '지도에서 6번 안에 닿지 않음' }
  const { target, entries } = await relatedEntries(g, e, model, leads, vec)
  const base = { par, entries: entries.length, entryTitles: entries.slice(0, 8).map(x => `${g.titles[x.node]} ${x.sim.toFixed(2)}`) }
  if (entries.length < ENTRY.min) return { ...base, ok: false, hops: null, reason: `뜻이 가까운 진입점이 ${entries.length}개뿐` }

  const skip = (n: number) => unthinkable(g.titles[n]!)
  // 문은 언어 문서여도 된다(도착이 말과 글에 관한 문서일 때). 연도·목록은 문이 될 수 없다
  const usable = entries.filter(x => x.node !== s && !BOOKKEEPING.test(g.titles[x.node]!))
  const sim = new Map(usable.map(x => [x.node, x.sim]))
  const maxMoves = par + ENTRY.slack
  const toDoor = distanceToDoors(g, usable.map(x => x.node), maxMoves - 1, n => n !== s && skip(n))
  if (toDoor[s]! + 1 > maxMoves) return { ...base, ok: false, hops: null, reason: '뜻이 가까운 진입점이 출발에서 멀다' }

  const linksOf: LinksOf = async u => {
    const page = await wiki.page(g.titles[u]!)
    if (!page || g.byTitle.get(page.title) !== u) return null
    const seen = new Map<number, string>()
    for (const via of page.links) {
      const node = g.byTitle.get(via.charAt(0).toUpperCase() + via.slice(1))
      if (node !== undefined && !g.disambig[node] && !seen.has(node)) seen.set(node, via)
    }
    return [...seen].map(([node, via]) => ({ node, via }))
  }
  const rank = (n: number) => sim.get(n) ?? cosine(vec(n), target)
  const path = await guidedPath({ start: s, end: e, maxMoves, doors: new Set(sim.keys()), toDoor, linksOf, skip, rank })
  if (!path) return { ...base, ok: false, hops: null, reason: `문을 지나는 길을 문서 ${ENTRY.pages}장 안에서 못 찾음(없다는 뜻은 아님)` }
  return { ...base, ok: true, hops: path.map(({ node, via }) => ({ id: g.ids[node]!, title: g.titles[node]!, via })) }
}

export function loadEmbedModel(): EmbedModel {
  const modelDir = new URL('../../../packages/embed/model/', import.meta.url).pathname
  const meta = JSON.parse(readFileSync(join(modelDir, 'embed-v1.json'), 'utf8')) as ModelMeta
  const bin = readFileSync(join(modelDir, 'embed-v1.bin'))
  return loadModel(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
}

type Pair = { key: string; start: { id: number; title: string }; end: { id: number; title: string } }

/** reason 명령: 이미 있는 문제들을 검사한다. --in pairs.json → out/reason.json */
export async function reasonAll(graphDir: string, inPath: string, outPath: string): Promise<void> {
  const g = loadGraph(graphDir)
  const model = loadEmbedModel()
  const wiki = new Wiki()
  const leads = new Leads(wiki)
  const vec = titleVectors(g, model)
  const nodeOfId = new Map<number, number>()
  g.ids.forEach((id, n) => nodeOfId.set(id, n))
  const pairs = JSON.parse(readFileSync(inPath, 'utf8')) as Pair[]
  // 중간에 멈췄으면 끝난 것은 건너뛰고 이어서 한다
  const out: (Pair & Verdict)[] = existsSync(outPath) ? (JSON.parse(readFileSync(outPath, 'utf8')) as (Pair & Verdict)[]).filter(x => pairs.some(p => p.key === x.key)) : []
  const done = new Set(out.map(x => x.key))
  for (const p of pairs) {
    if (done.has(p.key)) continue
    const s = nodeOfId.get(p.start.id) ?? g.byTitle.get(p.start.title)
    const e = nodeOfId.get(p.end.id) ?? g.byTitle.get(p.end.title)
    let v: Verdict
    if (s === undefined || e === undefined) v = { ok: false, par: -1, entries: 0, entryTitles: [], hops: null, reason: '지도에 없는 문서' }
    else v = await checkReason(g, s, e, model, leads, vec, wiki)
    out.push({ ...p, ...v })
    const path = v.hops ? [p.start.title, ...v.hops.map(h => h.title)].join(' > ') : ''
    console.log(`${v.ok ? '통과' : '실패'} ${p.key} ${p.start.title} → ${p.end.title} · ${v.par}번 · 문 ${v.entries} · ${v.ok ? path : v.reason}`)
    writeFileSync(outPath, JSON.stringify(out, null, 1))
  }
  console.log(`통과 ${out.filter(x => x.ok).length} / ${out.length} · 위키백과 요청 ${wiki.requests}`)
}

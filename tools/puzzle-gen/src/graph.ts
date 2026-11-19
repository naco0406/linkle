import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanDump } from './sql.ts'

/**
 * 한국어 위키백과 전체의 링크 지도.
 *
 * 덤프의 링크 표(pagelinks)는 문서가 가진 모든 링크다. 탐색 상자, 같이 보기처럼 게임이 지우는 링크도 들어 있다.
 * 그래서 이 지도의 최단 거리는 게임의 최단 거리보다 길 수 없다(하한). "이 지도에서 3번 이상"이면 게임에서도 3번 이상이다.
 * 넘겨주기는 최종 문서로 풀어 둔다. 게임도 넘겨주기를 따라가서 도착 문서를 정한다.
 */
export type Graph = {
  /** 노드 번호 → 문서 id, 제목(밑줄 없이) */
  ids: Int32Array
  titles: string[]
  disambig: Uint8Array
  /** 나가는 링크(CSR): i의 이웃은 out[outAt[i] .. outAt[i+1]) */
  outAt: Int32Array
  out: Int32Array
  /** 들어오는 링크 */
  inAt: Int32Array
  in: Int32Array
  /** 제목(넘겨주기 포함) → 노드 번호. 게임 문서의 링크 제목을 노드로 바꿀 때 쓴다 */
  byTitle: Map<string, number>
}

/** 덤프의 제목 꼴: 밑줄. 화면과 게임의 꼴: 띄어쓰기 */
export const toDumpTitle = (t: string) => {
  const s = t.trim().replaceAll(' ', '_')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const fromDumpTitle = (t: string) => t.replaceAll('_', ' ')

/** 자라는 Int32 배열. 1억 개 가까운 링크를 담느라 몇 MB씩 덩어리로 늘린다 */
class IntList {
  chunks: Int32Array[] = []
  size = 0
  private static CHUNK = 1 << 22
  push(v: number) {
    const k = this.size >>> 22
    if (k === this.chunks.length) this.chunks.push(new Int32Array(IntList.CHUNK))
    this.chunks[k]![this.size & (IntList.CHUNK - 1)] = v
    this.size++
  }
  get(i: number): number {
    return this.chunks[i >>> 22]![i & (IntList.CHUNK - 1)]!
  }
}

function grow(a: Int32Array<ArrayBuffer>, need: number, fill: number): Int32Array<ArrayBuffer> {
  if (need < a.length) return a
  const b = new Int32Array(Math.max(need + 1, a.length * 2)).fill(fill)
  b.set(a)
  return b
}

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)

export async function buildGraph(dir: string, outDir: string): Promise<void> {
  const f = (name: string) => join(dir, `kowiki-latest-${name}.sql.gz`)

  // 1. 일반 문서(이름공간 0)의 제목 → 문서 id, 넘겨주기 여부
  const titleToPage = new Map<string, number>()
  let isRedirect = new Uint8Array(1 << 22)
  let maxPage = 0
  await scanDump(f('page'), (r, c) => {
    if (r[c.page_namespace!] !== 0) return
    const id = r[c.page_id!] as number
    titleToPage.set(String(r[c.page_title!]), id)
    if (id >= isRedirect.length) {
      const b = new Uint8Array(Math.max(id + 1, isRedirect.length * 2))
      b.set(isRedirect)
      isRedirect = b
    }
    if (r[c.page_is_redirect!] === 1) isRedirect[id] = 1
    if (id > maxPage) maxPage = id
  })
  log(`page: ${titleToPage.size} titles`)

  // 2. 넘겨주기 문서 id → 대상 문서 id
  let redirectTo = new Int32Array(maxPage + 1).fill(-1)
  await scanDump(f('redirect'), (r, c) => {
    if (r[c.rd_namespace!] !== 0 || r[c.rd_interwiki!]) return
    const to = titleToPage.get(String(r[c.rd_title!]))
    if (to !== undefined) redirectTo = grow(redirectTo, r[c.rd_from!] as number, -1)
    if (to !== undefined) redirectTo[r[c.rd_from!] as number] = to
  })
  /** 넘겨주기를 끝까지 풀어 일반 문서 id를 돌려준다. 고리나 끊긴 넘겨주기는 -1 */
  const resolve = (page: number): number => {
    for (let hop = 0; hop < 4; hop++) {
      if (!isRedirect[page]) return page
      const next = redirectTo[page] ?? -1
      if (next < 0) return -1
      page = next
    }
    return -1
  }

  // 3. 노드 번호: 넘겨주기가 아닌 일반 문서만
  const nodeOf = new Int32Array(maxPage + 1).fill(-1)
  const ids: number[] = []
  const titles: string[] = []
  for (const [title, id] of titleToPage) {
    if (isRedirect[id]) continue
    nodeOf[id] = ids.length
    ids.push(id)
    titles.push(fromDumpTitle(title))
  }
  const N = ids.length
  log(`nodes: ${N}`)

  // 4. 동음이의 문서
  const disambig = new Uint8Array(N)
  await scanDump(f('page_props'), (r, c) => {
    if (r[c.pp_propname!] !== 'disambiguation') return
    const n = nodeOf[r[c.pp_page!] as number] ?? -1
    if (n >= 0) disambig[n] = 1
  })

  // 5. 링크 대상 id → 노드 번호 (넘겨주기를 푼 뒤)
  let target = new Int32Array(1 << 24).fill(-1)
  await scanDump(f('linktarget'), (r, c) => {
    if (r[c.lt_namespace!] !== 0) return
    const page = titleToPage.get(String(r[c.lt_title!]))
    if (page === undefined) return
    const p = resolve(page)
    if (p < 0) return
    const lt = r[c.lt_id!] as number
    target = grow(target, lt, -1)
    target[lt] = nodeOf[p]!
  })
  log('linktarget done')

  // 6. 링크: 일반 문서 → 일반 문서
  const from = new IntList()
  const to = new IntList()
  const rows = await scanDump(f('pagelinks'), (r, c) => {
    if (r[c.pl_from_namespace!] !== 0) return
    const a = nodeOf[r[c.pl_from!] as number] ?? -1
    const lt = r[c.pl_target_id!] as number
    const b = lt < target.length ? target[lt]! : -1
    if (a < 0 || b < 0 || a === b) return
    from.push(a)
    to.push(b)
  })
  log(`pagelinks: ${rows} rows, ${from.size} kept`)

  const csr = (src: IntList, dst: IntList) => {
    const at = new Int32Array(N + 1)
    for (let i = 0; i < src.size; i++) at[src.get(i) + 1]!++
    for (let i = 0; i < N; i++) at[i + 1]! += at[i]!
    const fill = at.slice(0, N)
    const adj = new Int32Array(src.size)
    for (let i = 0; i < src.size; i++) adj[fill[src.get(i)]!++] = dst.get(i)
    // 이웃을 정렬하고 겹친 것을 지운다(넘겨주기를 풀면 같은 문서로 가는 링크가 둘 생길 수 있다)
    const outAt = new Int32Array(N + 1)
    let w = 0
    for (let i = 0; i < N; i++) {
      const seg = adj.subarray(at[i]!, at[i + 1]!).sort()
      outAt[i] = w
      for (let k = 0; k < seg.length; k++) if (k === 0 || seg[k] !== seg[k - 1]) adj[w++] = seg[k]!
    }
    outAt[N] = w
    return { at: outAt, adj: adj.slice(0, w) }
  }
  const fwd = csr(from, to)
  const rev = csr(to, from)
  log(`edges: ${fwd.adj.length}`)

  // 7. 저장. 넘겨주기 제목도 남겨 게임 문서의 링크 제목을 노드로 바꿀 수 있게 한다
  mkdirSync(outDir, { recursive: true })
  const aliases: [string, number][] = []
  for (const [title, id] of titleToPage) {
    if (!isRedirect[id]) continue
    const p = resolve(id)
    if (p >= 0 && nodeOf[p]! >= 0) aliases.push([fromDumpTitle(title), nodeOf[p]!])
  }
  writeFileSync(join(outDir, 'nodes.json'), JSON.stringify({ ids, titles, aliases }))
  for (const [name, arr] of Object.entries({ disambig, outAt: fwd.at, out: fwd.adj, inAt: rev.at, in: rev.adj })) {
    writeFileSync(join(outDir, `${name}.bin`), Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength))
  }
  log(`saved to ${outDir}`)
}

export function loadGraph(outDir: string): Graph {
  const { ids, titles, aliases } = JSON.parse(readFileSync(join(outDir, 'nodes.json'), 'utf8')) as { ids: number[]; titles: string[]; aliases: [string, number][] }
  const bin = (name: string) => {
    const b = readFileSync(join(outDir, `${name}.bin`))
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }
  const byTitle = new Map<string, number>()
  titles.forEach((t, i) => byTitle.set(t, i))
  for (const [t, n] of aliases) if (!byTitle.has(t)) byTitle.set(t, n)
  return {
    ids: Int32Array.from(ids),
    titles,
    disambig: new Uint8Array(bin('disambig')),
    outAt: new Int32Array(bin('outAt')),
    out: new Int32Array(bin('out')),
    inAt: new Int32Array(bin('inAt')),
    in: new Int32Array(bin('in')),
    byTitle,
  }
}

export const outDegree = (g: Pick<Graph, 'outAt'>, n: number) => g.outAt[n + 1]! - g.outAt[n]!
export const inDegree = (g: Pick<Graph, 'inAt'>, n: number) => g.inAt[n + 1]! - g.inAt[n]!

/**
 * 한 출발 문서에서 모든 문서까지의 최단 거리와, 그 거리로 가는 길의 수.
 * 길의 수가 많을수록 찾기 쉬운 문제다. maxDepth를 넘는 문서는 거리 255로 남는다.
 */
export function bfs(g: Pick<Graph, 'outAt' | 'out'>, start: number, maxDepth: number): { dist: Uint8Array; ways: Float64Array } {
  const N = g.outAt.length - 1
  const dist = new Uint8Array(N).fill(255)
  const ways = new Float64Array(N)
  let frontier = [start]
  dist[start] = 0
  ways[start] = 1
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: number[] = []
    for (const u of frontier) {
      for (let k = g.outAt[u]!; k < g.outAt[u + 1]!; k++) {
        const v = g.out[k]!
        if (dist[v] === 255) {
          dist[v] = d
          next.push(v)
        }
        if (dist[v] === d) ways[v]! += ways[u]!
      }
    }
    frontier = next
  }
  return { dist, ways }
}

/**
 * 최단 경로 하나를 뒤에서부터 고른다. 길의 수에 비례해 고르므로 모든 최단 경로가 같은 확률로 나온다.
 * rand는 0 이상 1 미만의 수를 돌려주는 함수다(시험에서 같은 결과를 내려고 바꿔 끼운다).
 */
export function samplePath(g: Pick<Graph, 'inAt' | 'in'>, bfsResult: { dist: Uint8Array; ways: Float64Array }, end: number, rand: () => number): number[] {
  const { dist, ways } = bfsResult
  const path = [end]
  let v = end
  while (dist[v] !== 0) {
    let total = 0
    for (let k = g.inAt[v]!; k < g.inAt[v + 1]!; k++) if (dist[g.in[k]!] === dist[v]! - 1) total += ways[g.in[k]!]!
    let pick = rand() * total
    let chosen = -1
    for (let k = g.inAt[v]!; k < g.inAt[v + 1]!; k++) {
      const u = g.in[k]!
      if (dist[u] !== dist[v]! - 1) continue
      chosen = u
      pick -= ways[u]!
      if (pick < 0) break
    }
    v = chosen
    path.push(v)
  }
  return path.reverse()
}

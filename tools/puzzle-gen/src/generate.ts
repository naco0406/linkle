import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { levelOf } from '@linkle/core'
import { embed, loadModel, makeLead, score01, type ModelMeta } from '@linkle/embed'
import { bfs, inDegree, loadGraph, outDegree, samplePath, type Graph } from './graph.ts'
import { canEnd, canStart, difficultyOf, quotas, RULES, seeded, shuffle, type Difficulty } from './pick.ts'
import { buildPool } from './pool.ts'
import { Wiki } from './wiki.ts'

/** 게임에서 실제로 누를 수 있는 링크로 이어진 길. 문제의 정답 예시로 저장한다(사용자에게는 보내지 않는다) */
export type Hop = { id: number; title: string; via: string }

export type Candidate = {
  start: { id: number; title: string }
  end: { id: number; title: string }
  par: number
  ways: number
  endIn: number
  startOut: number
  similarity: number
  difficulty: Difficulty
  solution: Hop[]
}

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)

/**
 * CI(GitHub Actions)에서는 문제 이름과 정답 경로를 찍지 않는다. 저장소가 공개라 실행 기록을 누구나 본다.
 * 손으로 돌릴 때는 검토하려고 다 찍는다.
 */
const HIDE = !!process.env.CI
/** 위키백과가 제목을 저장하는 꼴: 첫 글자는 대문자 */
const norm = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * 링크 지도의 최단 경로가 게임에서도 갈 수 있는 길인지 확인한다.
 * 각 문서를 게임과 같은 규칙(packages/wiki)으로 정리하고, 다음 문서로 가는 링크가 남아 있는지 본다.
 * 지도에는 탐색 상자 링크도 있어서, 지도의 최단 경로가 게임에서는 막혀 있을 수 있다.
 */
export async function gamePath(g: Graph, path: number[], wiki: Wiki): Promise<Hop[] | null> {
  const hops: Hop[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i]!
    const v = path[i + 1]!
    const page = await wiki.page(g.titles[u]!)
    if (!page || g.byTitle.get(page.title) !== u) return null
    const via = page.links.find(t => g.byTitle.get(norm(t)) === v)
    if (!via) return null
    hops.push({ id: g.ids[v]!, title: g.titles[v]!, via })
  }
  return hops
}

/** 출발과 도착이 주제로 얼마나 가까운지(0~1). 게임의 유사도 모델을 그대로 쓴다 */
async function similarity(titles: [string, string], wiki: Wiki, model: ReturnType<typeof loadModel>): Promise<number> {
  const res = (await wiki.api({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', titles: titles.join('|') })) as {
    query?: { pages?: { title: string; extract?: string }[] }
  }
  const lead = (t: string) => makeLead(t, res.query?.pages?.find(p => p.title === t)?.extract ?? '')
  return score01(model, embed(model, lead(titles[0])), embed(model, lead(titles[1])))
}

export async function generate(o: { graphDir: string; outDir: string; count: number; seed: number; pool?: 'daily' | 'official'; exclude?: string[] }): Promise<Candidate[]> {
  const g = loadGraph(o.graphDir)
  const rand = seeded(o.seed)
  const wiki = new Wiki()
  const modelDir = new URL('../../../packages/embed/model/', import.meta.url).pathname
  const meta = JSON.parse(readFileSync(join(modelDir, 'embed-v1.json'), 'utf8')) as ModelMeta
  const bin = readFileSync(join(modelDir, 'embed-v1.bin'))
  const model = loadModel(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))

  const { pool, vital, popular, living } = await buildPool(g, wiki, new Date())
  const starts = shuffle(pool.filter(n => canStart(g, n)), rand)
  const ends = new Set(pool.filter(n => canEnd(g, n)))
  log(`지도 ${g.titles.length}개 문서 · 기본 문서 ${vital} · 꾸준히 인기 ${popular} · 살아 있는 사람 ${living} 뺌 · 후보 문서 ${pool.length} (출발 ${starts.length}, 도착 ${ends.size})`)

  // 이미 대기열이나 문제에 쓴 문서는 다시 쓰지 않는다. 오늘의 문제와 커뮤니티 문제가 겹치면 답이 샌다
  const used = new Set<number>((o.exclude ?? []).map(t => g.byTitle.get(t)).filter((n): n is number => n !== undefined))
  const found: Candidate[] = []
  const tally = { tried: 0, close: 0, blocked: 0, full: 0 }
  // 오늘의 문제는 난이도별 개수를 맞춘다(요일 비율). 커뮤니티 문제는 비율을 따지지 않는다
  const want = o.pool === 'official' ? null : quotas(o.count)
  const need = (d: Difficulty) => !want || found.filter(c => c.difficulty === d).length < want[d]
  // 첫 바퀴는 비율을 지키고, 그래도 모자라면 두 번째 바퀴에서 아무 난이도나 채운다
  for (const relaxed of want ? [false, true] : [true]) {
  for (const s of starts) {
    if (found.length >= o.count) break
    if (used.has(s)) continue
    const reach = bfs(g, s, RULES.maxDist)
    // 너무 쉽지도(지도에서 3번 미만) 너무 멀지도 않은 도착 문서. 인기 문서끼리는 거의 3번 안에 닿아
    // 3~4번 중에서 고르게 뽑으면 4번(어려움)이 열에 하나꼴이다. 어려움이 모자라면 4번 거리부터 고른다
    const at = (k: number) => [...ends].filter(e => !used.has(e) && e !== s && reach.dist[e] === k)
    const far = at(RULES.maxDist)
    const near = Array.from({ length: RULES.maxDist - RULES.minDist }, (_, i) => at(RULES.minDist + i)).flat()
    const pickFar = far.length > 0 && (need('hard') || near.length === 0) && !(relaxed && !need('hard') && near.length > 0)
    const options = shuffle(pickFar ? far : near, rand)
    const e = options[0]
    if (e === undefined) continue
    // 4번 거리를 못 찾은 출발에서 어려움만 모자라면, 쉬움·보통이 다 찼을 때는 넘어간다
    if (!relaxed && !pickFar && !need('easy') && !need('normal')) {
      tally.full++
      continue
    }
    tally.tried++
    const [st, et] = [g.titles[s]!, g.titles[e]!]

    // 주제가 이미 가까우면 재미가 없다(유사도 색으로 🟩·🟦)
    const sim = await similarity([st, et], wiki, model)
    if (levelOf(sim) >= 3) {
      tally.close++
      continue
    }

    // 지도의 최단 경로를 몇 개 뽑아, 그중 하나라도 게임에서 그대로 갈 수 있으면 통과
    let solution: Hop[] | null = null
    const tried = new Set<string>()
    for (let k = 0; k < 12 && !solution && tried.size < 6; k++) {
      const path = samplePath(g, reach, e, rand)
      const key = path.join('>')
      if (tried.has(key)) continue
      tried.add(key)
      solution = await gamePath(g, path, wiki)
    }
    if (!solution) {
      tally.blocked++
      continue
    }

    const par = reach.dist[e]!
    const c: Candidate = {
      start: { id: g.ids[s]!, title: st },
      end: { id: g.ids[e]!, title: et },
      par,
      ways: reach.ways[e]!,
      endIn: inDegree(g, e),
      startOut: outDegree(g, s),
      similarity: Math.round(sim * 100) / 100,
      difficulty: difficultyOf(par, reach.ways[e]!, inDegree(g, e)),
      solution,
    }
    if (!relaxed && !need(c.difficulty)) {
      // 이 난이도는 이미 찼다. 출발 문서는 다음 바퀴에 다시 쓸 수 있게 남겨 둔다
      tally.full++
      continue
    }
    found.push(c)
    used.add(s)
    used.add(e)
    log(
      HIDE
        ? `${found.length}/${o.count} · ${par}번 · ${c.difficulty}`
        : `${found.length}/${o.count} ${st} → ${et} · ${par}번 · ${c.difficulty} · 길 ${c.ways} · 유사도 ${c.similarity} · ${[st, ...solution.map(h => h.title)].join(' > ')}`,
    )
  }
  }
  const mix = (['easy', 'normal', 'hard'] as const).map(d => `${d} ${found.filter(c => c.difficulty === d).length}${want ? `/${want[d]}` : ''}`).join(' · ')
  log(`시도 ${tally.tried} · 주제가 가까워 뺌 ${tally.close} · 게임에서 막혀 뺌 ${tally.blocked} · 난이도가 차서 넘김 ${tally.full} · ${mix} · 위키백과 요청 ${wiki.requests}`)

  mkdirSync(o.outDir, { recursive: true })
  writeFileSync(join(o.outDir, 'candidates.json'), JSON.stringify(found, null, 1))
  const file = o.pool === 'official' ? 'official.sql' : 'queue.sql'
  writeFileSync(join(o.outDir, file), o.pool === 'official' ? officialSql(found, Date.now()) : queueSql(found, Date.now()))
  log(`${o.outDir}/${file}: ${found.length}개`)
  return found
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`

/** 문제 대기열에 넣는 SQL. 같은 쌍은 한 번만 들어간다 */
export function queueSql(items: Candidate[], now: number): string {
  if (items.length === 0) return '-- 후보 없음\n'
  const rows = items.map(
    c =>
      `(${c.start.id}, ${q(c.start.title)}, ${c.end.id}, ${q(c.end.title)}, ${c.par}, ${q(c.difficulty)}, ${q(JSON.stringify(c.solution))}, 'approved', 'daily', ${now})`,
  )
  return `INSERT OR IGNORE INTO puzzle_queue (start_id, start_title, end_id, end_title, par, difficulty, solution, status, pool, created_at) VALUES\n${rows.join(',\n')};\n`
}

/**
 * 커뮤니티의 "링클이 낸 문제"로 바로 공개하는 SQL. 번호는 링클이 낸 문제끼리 이어진다.
 * 한 줄씩 넣어야 앞 줄이 넣은 번호를 다음 줄이 본다. 같은 쌍은 한 번만 들어간다(puzzles_pair).
 */
export function officialSql(items: Candidate[], now: number): string {
  if (items.length === 0) return '-- 후보 없음\n'
  return items
    .map(
      c =>
        `INSERT OR IGNORE INTO puzzles (kind, number, start_id, start_title, end_id, end_title, par, difficulty, solution, status, created_at)\n` +
        `SELECT 'official', COALESCE(MAX(number), 0) + 1, ${c.start.id}, ${q(c.start.title)}, ${c.end.id}, ${q(c.end.title)}, ${c.par}, ${q(c.difficulty)}, ${q(JSON.stringify(c.solution))}, 'published', ${now} FROM puzzles WHERE kind = 'official';`,
    )
    .join('\n')
    .concat('\n')
}

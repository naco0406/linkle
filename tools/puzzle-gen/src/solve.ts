import { readFileSync, writeFileSync } from 'node:fs'
import { gamePath, type Hop } from './generate.ts'
import { bfs, inDegree, loadGraph, samplePath } from './graph.ts'
import { difficultyOf, seeded } from './pick.ts'
import { Wiki } from './wiki.ts'

// 이미 정해진 출발·도착 쌍의 정답 경로를 찾는다. 사람이 고른 문제나 개발용 씨앗에 정답을 붙일 때 쓴다.
// 지도에서 최단 경로를 몇 개 뽑아, 게임 규칙으로도 갈 수 있는 첫 길을 정답으로 삼는다.

type Pair = { start: { id: number; title: string }; end: { id: number; title: string } }
export type Solved = Pair & { par: number | null; difficulty: string | null; solution: Hop[] | null; note?: string }

const MAX_DEPTH = 6

export async function solve(graphDir: string, file: string, out: string): Promise<Solved[]> {
  const pairs = JSON.parse(readFileSync(file, 'utf8')) as Pair[]
  const g = loadGraph(graphDir)
  const node = new Map<number, number>()
  g.ids.forEach((id, n) => node.set(id, n))
  const wiki = new Wiki()
  const rand = seeded(1)
  const result: Solved[] = []
  for (const p of pairs) {
    const s = node.get(p.start.id)
    const e = node.get(p.end.id)
    if (s === undefined || e === undefined) {
      result.push({ ...p, par: null, difficulty: null, solution: null, note: '지도에 없는 문서' })
      continue
    }
    const reach = bfs(g, s, MAX_DEPTH)
    const dist = reach.dist[e]!
    if (!dist || dist > MAX_DEPTH) {
      result.push({ ...p, par: null, difficulty: null, solution: null, note: `${MAX_DEPTH}번 안에 닿지 않음` })
      continue
    }
    let solution: Hop[] | null = null
    const tried = new Set<string>()
    for (let k = 0; k < 16 && !solution && tried.size < 8; k++) {
      const path = samplePath(g, reach, e, rand)
      const key = path.join('>')
      if (tried.has(key)) continue
      tried.add(key)
      solution = await gamePath(g, path, wiki)
    }
    const r: Solved = { ...p, par: dist, difficulty: difficultyOf(dist, reach.ways[e]!, inDegree(g, e)), solution, ...(solution ? {} : { note: '게임에서 막힘' }) }
    result.push(r)
    console.log(`${p.start.title} → ${p.end.title} · ${dist}번 · ${r.difficulty} · ${solution ? [p.start.title, ...solution.map(h => h.title)].join(' > ') : r.note}`)
  }
  writeFileSync(out, JSON.stringify(result, null, 1))
  return result
}

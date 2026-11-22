import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { generate } from './generate.ts'

// 위키백과와 지도 없이 "어느 거리의 도착을 고르는가"만 시험한다.
// 어느 출발에서든 3번과 4번 거리 도착이 모두 있다. 3번 거리는 쉬움과 보통이 반씩이다.
const N = 300
const dist = (e: number) => (e % 3 === 0 ? 4 : 3)

vi.mock('./graph.ts', async original => ({
  ...(await original<typeof import('./graph.ts')>()),
  loadGraph: () => ({ titles: Array.from({ length: N }, (_, n) => `문서${n}`), ids: Array.from({ length: N }, (_, n) => n + 1), byTitle: new Map(), disambig: new Uint8Array(N) }),
  bfs: () => ({ dist: Array.from({ length: N }, (_, n) => dist(n)), ways: Array.from({ length: N }, (_, n) => (n % 3 === 1 ? 50 : 1)) }),
  inDegree: () => 100,
  outDegree: () => 100,
}))
vi.mock('./pick.ts', async original => ({ ...(await original<typeof import('./pick.ts')>()), canStart: () => true, canEnd: () => true }))
vi.mock('./pool.ts', () => ({ buildPool: async () => ({ pool: Array.from({ length: N }, (_, n) => n), vital: 0, popular: 0, living: 0 }) }))
vi.mock('./wiki.ts', () => ({ Wiki: class { requests = 0 } }))
vi.mock('@linkle/embed', () => ({ embed: () => null, makeLead: () => '', score01: () => 0.1 }))
vi.mock('./reason.ts', () => ({
  Leads: class {
    get = async () => new Map()
  },
  loadEmbedModel: () => ({}),
  titleVectors: () => () => null,
  checkReason: async (_g: unknown, _s: number, e: number) => ({ ok: true, par: dist(e), hops: [{ id: e + 1, title: `문서${e}`, via: `문서${e}` }] }),
}))

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })))

it.each([
  ['official', 5, { easy: 1, normal: 3, hard: 1 }],
  ['official', 8, { easy: 2, normal: 4, hard: 2 }],
  ['daily', 7, { easy: 2, normal: 3, hard: 2 }],
] as const)('%s %i개: 난이도가 섞인다', async (pool, count, want) => {
  const outDir = mkdtempSync(join(tmpdir(), 'linkle-gen-'))
  dirs.push(outDir)
  const found = await generate({ graphDir: '', outDir, count, seed: 1, pool })
  const n = (d: string) => found.filter(c => c.difficulty === d).length
  expect({ easy: n('easy'), normal: n('normal'), hard: n('hard') }).toEqual(want)
})

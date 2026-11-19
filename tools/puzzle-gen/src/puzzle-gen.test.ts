import { describe, expect, it } from 'vitest'
import { bfs, samplePath } from './graph.ts'
import { queueSql, type Candidate } from './generate.ts'
import { difficultyOf, seeded, shuffle, titleOk } from './pick.ts'
import { columnsOf, parseValues, type Value } from './sql.ts'

describe('덤프 읽기', () => {
  const rows = (line: string, start = 0) => {
    const out: Value[][] = []
    const row: Value[] = []
    parseValues(line, start, row, () => out.push([...row]))
    return out
  }
  it('한 줄에 한 행(지금 덤프)', () => {
    expect(rows("(60,0,'민주당_(2000년_대한민국)','',''),")).toEqual([[60, 0, '민주당_(2000년_대한민국)', '', '']])
  })
  it('한 줄에 여러 행(예전 덤프)과 NULL, 이스케이프', () => {
    const line = "INSERT INTO `t` VALUES (1,'it\\'s',NULL),(2,'a\\\\b\\nc',-3.5);"
    expect(rows(line, line.indexOf('VALUES') + 6)).toEqual([
      [1, "it's", null],
      [2, 'a\\b\nc', -3.5],
    ])
  })
  it('문자열 안의 괄호와 쉼표', () => {
    expect(rows("(5,'a,(b)',7)")).toEqual([[5, 'a,(b)', 7]])
  })
  it('표 정의에서 열 이름을 순서대로 읽는다', () => {
    const create = 'CREATE TABLE `redirect` (\n  `rd_from` int(8) unsigned NOT NULL,\n  `rd_namespace` int(11) NOT NULL,\n  `rd_title` varbinary(255),\n  PRIMARY KEY (`rd_from`)\n)'
    expect(columnsOf(create)).toEqual({ rd_from: 0, rd_namespace: 1, rd_title: 2 })
  })
})

// 0 → 1 → 2 → 4, 0 → 3 → 4, 0 → 5 → 4 : 4까지 거리 2, 길 셋. 6은 닿지 않는다
const edges: [number, number][] = [[0, 1], [1, 2], [2, 4], [0, 3], [3, 4], [0, 5], [5, 4], [4, 0]]
function tiny() {
  const N = 7
  const csr = (pairs: [number, number][]) => {
    const at = new Int32Array(N + 1)
    for (const [a] of pairs) at[a + 1]!++
    for (let i = 0; i < N; i++) at[i + 1]! += at[i]!
    const fill = at.slice(0, N)
    const adj = new Int32Array(pairs.length)
    for (const [a, b] of pairs) adj[fill[a]!++] = b
    return { at, adj }
  }
  const f = csr(edges)
  const r = csr(edges.map(([a, b]) => [b, a]))
  return { outAt: f.at, out: f.adj, inAt: r.at, in: r.adj }
}

describe('링크 지도에서 길 찾기', () => {
  const g = tiny()
  it('최단 거리와 그 거리로 가는 길의 수', () => {
    const r = bfs(g, 0, 5)
    expect([...r.dist]).toEqual([0, 1, 2, 1, 2, 1, 255])
    expect(r.ways[4]).toBe(2)
    expect(r.ways[2]).toBe(1)
  })
  it('최단 경로를 고루 뽑는다', () => {
    const r = bfs(g, 0, 5)
    const seen = new Set<string>()
    const rand = seeded(7)
    for (let i = 0; i < 40; i++) seen.add(samplePath(g, r, 4, rand).join('>'))
    expect([...seen].sort()).toEqual(['0>3>4', '0>5>4'])
  })
})

describe('후보 규칙', () => {
  it('날짜·목록·사건·괄호 제목은 쓰지 않는다', () => {
    expect(['커피', '아이작 뉴턴', '라면'].every(titleOk)).toBe(true)
    expect(['1988년', '3월 1일', '19세기', '한국의 섬 목록', '세월호 침몰 사고', '한국 전쟁', '간 (해부학)', '.hr', 'DNA', '육영수 저격 사건', '버닝썬 게이트', '유두', '장염', '보수주의'].some(titleOk)).toBe(false)
  })
  it('예상 난이도', () => {
    expect(difficultyOf(3, 50, 800)).toBe('easy')
    expect(difficultyOf(3, 4, 800)).toBe('normal')
    expect(difficultyOf(4, 3, 800)).toBe('hard')
    expect(difficultyOf(4, 30, 100)).toBe('hard')
    expect(difficultyOf(4, 30, 800)).toBe('normal')
  })
  it('시드가 같으면 같은 순서', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(3))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(3)))
  })
})

describe('대기열 SQL', () => {
  it('작은따옴표를 이스케이프하고 같은 쌍은 무시한다', () => {
    const c = { start: { id: 1, title: "Rock 'n' roll" }, end: { id: 2, title: '커피' }, par: 3, difficulty: 'easy', solution: [{ id: 2, title: '커피', via: '커피' }] } as Candidate
    const sql = queueSql([c], 5)
    expect(sql).toContain("'Rock ''n'' roll'")
    expect(sql.startsWith('INSERT OR IGNORE INTO puzzle_queue')).toBe(true)
  })
})

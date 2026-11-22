import { describe, expect, it } from 'vitest'
import { bfs, samplePath } from './graph.ts'
import { queueSql, type Candidate } from './generate.ts'
import { difficultyOf, quotas, seeded, shuffle, titleOk, unthinkable } from './pick.ts'
import { distanceToDoors, guidedPath } from './reason.ts'
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
    expect(['1988년', '3월 1일', '19세기', '한국의 섬 목록', '세월호 침몰 사고', '한국 전쟁', '간 (해부학)', '.hr', 'DNA', '육영수 저격 사건', '버닝썬 게이트', '유두', '장염', '보수주의', '이오시프 스탈린', '도널드 트럼프 2기 행정부', '생식계'].some(titleOk)).toBe(false)
  })
  it('예상 난이도', () => {
    expect(difficultyOf(3, 50, 800)).toBe('easy')
    expect(difficultyOf(3, 4, 800)).toBe('normal')
    expect(difficultyOf(4, 3, 800)).toBe('hard')
    // 4번 거리는 길이 많고 인기 있는 도착이어도 어려움이다
    expect(difficultyOf(4, 300, 2000)).toBe('hard')
  })
  it('한 번 채울 때 난이도 비율은 요일과 같은 2:3:2', () => {
    expect(quotas(40)).toEqual({ easy: 11, normal: 18, hard: 11 })
    expect(quotas(7)).toEqual({ easy: 2, normal: 3, hard: 2 })
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

describe('추론 검사', () => {
  it('언어·연도·표기는 정답 길로 지나가지 않는다', () => {
    expect(['영어', '스페인어', '고대 그리스어', '2010년', '기원전 3세기', '6월', '화요일', '년', '협정 세계시', '작품 목록'].every(unthinkable)).toBe(true)
    expect(['연어', '상어', '인어', '언어', '요일', '프랑스', '인상주의', '그리스 신화', '소년'].some(unthinkable)).toBe(false)
  })
  it('민감한 제목은 후보에서 뺀다', () => {
    expect(['콘돔', '코카인', '사이비 종교', '성폭력'].some(titleOk)).toBe(false)
    expect(['에로스', '정자', '고환율', '대마도', '킬리만자로산'].every(titleOk)).toBe(true)
  })

  // 지도: 0 → 1 → 3(문) → 6(도착), 0 → 2 → 4(문) → 6, 0 → 5 → 3
  const edges = [[0, 1], [0, 2], [0, 5], [1, 3], [2, 4], [5, 3], [3, 6], [4, 6]] as const
  const inAt = new Int32Array(8)
  for (const [, b] of edges) inAt[b + 1]!++
  for (let i = 0; i < 7; i++) inAt[i + 1]! += inAt[i]!
  const ins = Int32Array.from([...edges].sort((a, b) => a[1] - b[1]).map(([a]) => a))
  const find = (game: Record<number, number[]>, o: { maxMoves?: number; skip?: (n: number) => boolean } = {}) => {
    const skip = o.skip ?? (() => false)
    return guidedPath({
      start: 0,
      end: 6,
      maxMoves: o.maxMoves ?? 3,
      doors: new Set([3, 4]),
      toDoor: distanceToDoors({ inAt, in: ins }, [3, 4], 3, skip),
      linksOf: async u => (game[u] ?? []).map(node => ({ node, via: String(node) })),
      skip,
      rank: n => -n,
    }).then(p => p?.map(x => x.node) ?? null)
  }
  it('지도에만 있는 링크(탐색 상자)에서 막히면 다른 문으로 돌아간다', async () => {
    expect(await find({ 0: [1, 2], 1: [], 2: [4], 4: [6] })).toEqual([2, 4, 6])
  })
  it('문에서 도착으로 가는 링크도 게임에 있어야 한다', async () => {
    expect(await find({ 0: [1], 1: [3], 3: [] })).toBeNull()
  })
  it('지나가지 않을 문서는 피한다', async () => {
    expect(await find({ 0: [1, 5], 1: [3], 5: [3], 3: [6] }, { skip: n => n === 1 })).toEqual([5, 3, 6])
  })
  it('정해진 횟수를 넘는 길은 쓰지 않는다', async () => {
    expect(await find({ 0: [1], 1: [3], 3: [6] }, { maxMoves: 2 })).toBeNull()
  })
})

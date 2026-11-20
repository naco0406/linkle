import { describe, expect, it } from 'vitest'
import type { MoveEvent, Puzzle } from '@linkle/core'
import { cleanEmoji, initialStats, isDone, nextToCheck, pathOf, toPublic, winners, type Candidate, type StoredStats } from './daily.ts'
import { canAggregate, yesterdayOf } from './job.ts'
import { hopsOf, normalizeTitle, resolveTitles, verifyPath, WikiUnavailable, type WikiApi } from './verify.ts'
import { chooseOrder, solutionEvents, wantedDifficulty } from './schedule.ts'

const P = (id: number, title: string) => ({ id, title })
const START = P(7761, '불고기'), END = P(1043098, '뉴발란스')
const puzzle: Puzzle = { id: 1, kind: 'daily', number: 1, date: '2026-11-19', start: START, end: END }
const c = (runId: string, moves = 5, durationMs = 60_000): Candidate => ({ runId, moves, durationMs })
const stats = (shortest: Candidate[], fastest: Candidate[], checked: Record<string, string> = {}): StoredStats => ({
  ...initialStats(puzzle, { moves: [{ moves: 5, count: 2 }], medianMs: 60_000, topPages: [], shortest, fastest }),
  checked,
})

describe('집계 결과', () => {
  it('완료 인원은 이동 횟수 분포의 합이다', () => {
    const s = initialStats(puzzle, { moves: [{ moves: 4, count: 2 }, { moves: 9, count: 3 }], medianMs: 5, topPages: [], shortest: [c('a')], fastest: [c('a')] })
    expect(s.finished).toBe(5)
    expect(s.moves).toEqual({ 4: 2, 9: 3 })
    expect(s.done).toBe(false)
  })
  it('후보가 없으면 확인할 것도 없다', () => {
    expect(initialStats(puzzle, { moves: [], medianMs: null, topPages: [], shortest: [], fastest: [] }).done).toBe(true)
  })
  it('공개할 때는 후보와 확인 내역을 뺀다', () => {
    const pub = toPublic(stats([c('a')], [c('a')]))
    expect(pub).toMatchObject({ status: 'ready', verifying: true, finished: 2 })
    expect(Object.keys(pub)).not.toEqual(expect.arrayContaining(['candidates']))
    expect(JSON.stringify(pub)).not.toContain('"a"')
  })
})

describe('후보 확인 순서', () => {
  it('종류마다 앞에서부터 하나씩, 겹치면 한 번만', () => {
    expect(nextToCheck(stats([c('a'), c('b')], [c('a'), c('c')]))).toEqual(['a'])
    expect(nextToCheck(stats([c('a'), c('b')], [c('c'), c('a')]))).toEqual(['a', 'c'])
  })
  it('걸린 후보는 건너뛰고, 통과한 후보가 있으면 그 종류는 멈춘다', () => {
    const s = stats([c('a'), c('b'), c('d')], [c('c'), c('b')], { a: 'no_link@1', c: 'ok' })
    expect(nextToCheck(s)).toEqual(['b'])
    expect(winners(s)).toEqual({ shortest: null, fastest: 'c' })
  })
  it('앞의 후보를 아직 못 봤으면 뒤의 통과는 기록이 아니다', () => {
    expect(winners(stats([c('a'), c('b')], [], { b: 'ok' })).shortest).toBeNull()
  })
  it('기록이 정해졌거나 후보를 다 봤으면 끝', () => {
    expect(isDone(stats([c('a')], [c('b')], { a: 'no_link@0' }))).toBe(false)
    expect(isDone(stats([c('a')], [c('b')], { a: 'no_link@0', b: 'wrong_target@2' }))).toBe(true)
    const s = stats([c('a'), c('b')], [c('a')], { a: 'ok' })
    s.shortest = { moves: 5, durationMs: 1, path: [], emoji: null }
    s.fastest = s.shortest
    expect(isDone(s)).toBe(true)
  })
})

const ev = (...steps: (['link', number, string, string?] | ['back', number, string])[]): MoveEvent[] =>
  steps.map((s, i) => (s[0] === 'link' ? { type: 'link', to: P(s[1], s[2]), via: s[3] ?? s[2], at: i * 1000 } : { type: 'back', to: P(s[1], s[2]), at: i * 1000 }))

const path = ev(['link', 145056, '돼지고기'], ['back', 7761, '불고기'], ['link', 249, '대한민국'], ['link', 102860, '라리가', '프리메라리가'], ['link', 1043098, '뉴발란스'])

describe('기록에 싣는 값', () => {
  it('경로는 출발부터, 되돌아감을 표시한다', () => {
    expect(pathOf(START, path).map(p => `${p.title}${p.back ? '(뒤)' : ''}`)).toEqual(['불고기', '돼지고기', '불고기(뒤)', '대한민국', '라리가', '뉴발란스'])
  })
  it('되돌아감과 도착의 자리가 맞는 이모지만 싣는다', () => {
    expect(cleanEmoji(path, ['🟥', '⏪', '🟥', '🟨', '🏁'])).toEqual(['🟥', '⏪', '🟥', '🟨', '🏁'])
    expect(cleanEmoji(path, ['🟥', '🟦', '🟥', '🟨', '🏁'])).toBeNull()
    expect(cleanEmoji(path, ['🟥', '⏪', '🟥', '🟨'])).toBeNull()
    expect(cleanEmoji(path, ['🟥', '⏪', '🟥', '😀', '🏁'])).toBeNull()
    expect(cleanEmoji(path, null)).toBeNull()
  })
})

/** 위키백과 대역: 문서마다 링크 목록과 넘겨주기 */
function fakeWiki(links: Record<number, string[]>, pages: Record<string, number>, redirects: Record<string, string> = {}): WikiApi & { calls: Record<string, string>[] } {
  const calls: Record<string, string>[] = []
  const api = async (p: Record<string, string>) => {
    calls.push(p)
    if (p.prop === 'links') {
      const wanted = p.pltitles!.split('|')
      return { query: { pages: p.pageids!.split('|').map(id => ({ pageid: Number(id), links: (links[Number(id)] ?? []).filter(t => wanted.includes(t)).map(title => ({ ns: 0, title })) })) } }
    }
    const titles = p.titles!.split('|')
    return {
      query: {
        redirects: titles.filter(t => redirects[t]).map(t => ({ from: t, to: redirects[t]! })),
        pages: titles.map(t => redirects[t] ?? t).map(t => (pages[t] ? { pageid: pages[t], title: t } : { title: t, missing: true })),
      },
    }
  }
  return Object.assign(api, { calls })
}

const wiki = () =>
  fakeWiki(
    { 7761: ['돼지고기', '대한민국'], 249: ['프리메라리가', '축구'], 102860: ['뉴발란스'] },
    { 돼지고기: 145056, 대한민국: 249, 라리가: 102860, 뉴발란스: 1043098 },
    { 프리메라리가: '라리가' },
  )

describe('경로 확인', () => {
  it('링크 이동만 뽑는다. 되돌아간 뒤에는 그 전 문서에서 출발한다', () => {
    expect(hopsOf(START, path).map(h => `${h.from}>${h.via}>${h.to}`)).toEqual(['7761>돼지고기>145056', '7761>대한민국>249', '249>프리메라리가>102860', '102860>뉴발란스>1043098'])
  })
  it('제목은 위키백과가 저장하는 꼴로 맞춘다', () => {
    expect(normalizeTitle(' iPhone_15  프로 ')).toBe('IPhone 15 프로')
  })
  it('실제 링크로 이어지는 경로를 통과시킨다. 요청은 두 번이다', async () => {
    const api = wiki()
    expect(await verifyPath(START, path, api)).toEqual({ ok: true })
    expect(api.calls).toHaveLength(2)
  })
  it('없는 링크를 지어낸 경로를 거른다', async () => {
    const fake = ev(['link', 249, '대한민국'], ['link', 1043098, '뉴발란스'])
    expect(await verifyPath(START, fake, wiki())).toEqual({ ok: false, reason: 'no_link@1' })
  })
  it('누른 제목과 다른 문서에 도착했다고 적은 경로를 거른다', async () => {
    const fake = ev(['link', 249, '대한민국'], ['link', 1043098, '뉴발란스', '축구'])
    expect(await verifyPath(START, fake, wiki())).toEqual({ ok: false, reason: 'wrong_target@1' })
  })
  it('넘겨주기를 따라간다', async () => {
    const ids = await resolveTitles(['프리메라리가', '없는 문서'], wiki())
    expect([...ids]).toEqual([['프리메라리가', 102860]])
  })
  it('위키백과에 닿지 못하면 실패가 아니라 미룬다', async () => {
    const down: WikiApi = async () => {
      throw new WikiUnavailable('429')
    }
    await expect(verifyPath(START, path, down)).rejects.toBeInstanceOf(WikiUnavailable)
  })
})

describe('모으는 시각', () => {
  const kst = (iso: string) => Date.parse(`${iso}+09:00`)
  it('자정이 지나고 5분이 지나야 어제 것을 모은다', () => {
    expect(canAggregate(kst('2026-11-20T00:04:59'))).toBe(false)
    expect(canAggregate(kst('2026-11-20T00:05:00'))).toBe(true)
    expect(canAggregate(kst('2026-11-20T23:59:00'))).toBe(true)
  })
  it('어제는 한국 날짜 기준이다', () => {
    expect(yesterdayOf(kst('2026-11-20T00:10:00'))).toBe('2026-11-19')
    expect(yesterdayOf(kst('2026-12-01T08:00:00'))).toBe('2026-11-30')
  })
})

describe('출제 순서', () => {
  const row = (id: number, s: number, e: number, difficulty: 'easy' | 'normal' | 'hard' | null) => ({ id, start_id: s, start_title: `s${s}`, end_id: e, end_title: `e${e}`, par: 3, difficulty, solution: null })
  it('요일마다 난이도: 월·화 쉬움, 수~금 보통, 주말 어려움', () => {
    // 2026-11-16 월요일
    expect(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20', '2026-11-21', '2026-11-22'].map(wantedDifficulty)).toEqual(['easy', 'easy', 'normal', 'normal', 'hard', 'hard'])
  })
  it('원하는 난이도를 먼저, 최근 30일에 나온 문서는 건너뛴다', () => {
    const q = [row(1, 10, 11, 'normal'), row(2, 12, 13, 'hard'), row(3, 14, 15, 'hard'), row(4, 16, 99, 'hard')]
    expect(chooseOrder(q, new Set([14, 99]), 'hard').map(r => r.id)).toEqual([2, 1])
  })
  it('관리자가 당긴 문제는 난이도와 상관없이 먼저 낸다. 당긴 것끼리는 받은 순서', () => {
    const q = [{ ...row(1, 10, 11, 'easy'), priority: 5 }, row(2, 12, 13, 'hard'), { ...row(3, 14, 15, 'normal'), priority: 9 }, { ...row(4, 16, 17, 'easy'), priority: 3 }]
    expect(chooseOrder(q, new Set([16]), 'hard').map(r => r.id)).toEqual([1, 3, 2])
  })
  it('정답 예시를 이동 로그로 바꾼다', () => {
    expect(solutionEvents('[{"id":2,"title":"커피","via":"커피"}]')).toEqual([{ type: 'link', to: { id: 2, title: '커피' }, via: '커피', at: 0 }])
    expect(solutionEvents(null)).toBeNull()
    expect(solutionEvents('not json')).toBeNull()
    expect(solutionEvents('[]')).toBeNull()
  })
})

describe('관리용 API의 후보 확인', async () => {
  const { parseItem } = await import('./admin.ts')
  const ok = { start: { id: 1, title: '올림픽' }, end: { id: 2, title: '백과사전' }, par: 3, difficulty: 'easy', solution: [{ id: 5, title: '노르웨이', via: '노르웨이' }, { id: 2, title: '백과사전', via: '백과사전' }], ways: 9 }
  it('필요한 칸만 남긴다', () => {
    expect(parseItem(ok)).toEqual({ start: ok.start, end: ok.end, par: 3, difficulty: 'easy', solution: ok.solution })
  })
  it('정답 예시가 도착 문서에서 끝나지 않거나, 모양이 틀리면 받지 않는다', () => {
    expect(parseItem({ ...ok, solution: [{ id: 5, title: '노르웨이', via: '노르웨이' }] })).toBeNull()
    expect(parseItem({ ...ok, difficulty: 'impossible' })).toBeNull()
    expect(parseItem({ ...ok, end: ok.start })).toBeNull()
    expect(parseItem({ ...ok, par: 0 })).toBeNull()
    expect(parseItem(null)).toBeNull()
  })
})

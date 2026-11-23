import { describe, expect, it } from 'vitest'
import { animalOf, forkIndex, ghostAt, ghostOf, josa, nicknameOf, parseClientMessage, rankResults, shareOf, type ResultRow, type Run } from './index.ts'

const P = (id: number, title: string) => ({ id, title })

describe('친구와 겨루기: 고스트', () => {
  const events = [
    { type: 'link' as const, to: P(2, '중국'), via: '중국', at: 10_000 },
    { type: 'link' as const, to: P(3, '영국'), via: '영국', at: 25_000 },
    { type: 'link' as const, to: P(4, '산업 혁명'), via: '산업 혁명', at: 40_000 },
  ]
  const ghost = ghostOf('졸린 펭귄 2093', events, ['🟧', '🟩', '🏁'], 40_000)

  it('문서 이름 없이 시각과 색만 담는다', () => {
    expect(JSON.stringify(ghost)).not.toContain('영국')
    expect(ghost.steps).toEqual([
      { at: 10_000, emoji: '🟧' },
      { at: 25_000, emoji: '🟩' },
      { at: 40_000, emoji: '🏁' },
    ])
  })

  it('같은 경과 시간에 몇 번째였는지 알려 준다', () => {
    expect(ghostAt(ghost, 5_000)).toEqual({ moves: 0, emoji: null, arrived: false })
    expect(ghostAt(ghost, 30_000)).toEqual({ moves: 2, emoji: '🟩', arrived: false })
    expect(ghostAt(ghost, 41_000).arrived).toBe(true)
  })

  it('두 경로가 처음 갈린 자리', () => {
    expect(forkIndex([1, 2, 3], [1, 2, 5, 3])).toBe(2)
    expect(forkIndex([1, 2], [1, 2])).toBe(2)
  })
})

describe('친구와 겨루기: 이름', () => {
  it('salt를 바꾸면 다른 이름이 나오고, 같은 salt는 같은 이름이다', () => {
    const id = '6f1d2c4a-8b3e-4f7a-9c21-5d8e0b7a3f64'
    expect(nicknameOf(id, 0)).toBe(nicknameOf(id))
    expect(nicknameOf(id, 7)).toBe(nicknameOf(id, 7))
    expect(nicknameOf(id, 7)).not.toBe(nicknameOf(id, 0))
  })
  it('동물 첫 글자는 형용사에 띄어쓰기가 있어도 맞다', () => {
    expect(animalOf('파란 수달 4821')).toBe('수')
    expect(animalOf('호기심 많은 펭귄 1200')).toBe('펭')
  })
  it('받침에 따라 조사를 고른다', () => {
    expect(josa('토끼', '은', '는')).toBe('토끼는')
    expect(josa('수달', '은', '는')).toBe('수달은')
  })
})

describe('친구와 겨루기: 도전장 공유 문구', () => {
  const run: Run = {
    v: 1,
    mode: 'community',
    puzzle: { id: 16, kind: 'official', number: 16, date: null, start: P(1, '판다'), end: P(4, '산업 혁명') },
    runId: 'r',
    phase: 'finished',
    startedAt: 0,
    finishedAt: 51_000,
    events: [],
    leads: {},
    flags: [],
    emoji: ['🟧', '🟩', '🏁'],
    result: null,
    outbox: 'none',
  }
  it('첫 줄이 도전장이 되고 주소가 /c/코드로 바뀐다. 문서 이름은 없다', () => {
    const { text, url } = shareOf({ ...run, events: [{ type: 'link', to: P(4, '산업 혁명'), via: '산업 혁명', at: 51_000 }] }, { origin: 'https://linkle.naco.im', challenge: 'K3QF9M' })
    expect(text.split('\n')[0]).toBe('Linkle 커뮤니티 #16 도전장 🔗')
    expect(url).toBe('https://linkle.naco.im/c/K3QF9M')
    expect(text).not.toContain('판다')
  })
})

describe('같이 달리기: 메시지 검사와 결과 줄 세우기', () => {
  it('정해진 반응만 받는다', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'react', id: '🔥' }))).toEqual({ t: 'react', id: '🔥' })
    expect(parseClientMessage(JSON.stringify({ t: 'react', id: '안녕' }))).toBeNull()
  })
  it('모르는 칸은 버리고, 틀린 모양은 받지 않는다', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'move', moves: 2, back: false, level: 3, title: '중국', at: 900, extra: 'x' }))).toEqual({ t: 'move', moves: 2, back: false, level: 3, title: '중국', at: 900 })
    expect(parseClientMessage(JSON.stringify({ t: 'move', moves: 2, back: false, level: 9, title: '중국', at: 900 }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'rules', rules: { limit: 7 } }))).toBeNull()
    expect(parseClientMessage('not json')).toBeNull()
  })
  it('먼저 도착은 도착 순, 못 한 사람은 가까웠던 순', () => {
    const rows: ResultRow[] = [
      { seat: 0, name: 'a', ms: null, moves: 3, level: 1, title: 'x', state: 'stopped' },
      { seat: 1, name: 'b', ms: 90_000, moves: 6, level: null, title: 'y', state: 'arrived' },
      { seat: 2, name: 'c', ms: null, moves: 2, level: 3, title: 'z', state: 'stopped' },
      { seat: 3, name: 'd', ms: 80_000, moves: 4, level: null, title: 'y', state: 'arrived' },
    ]
    expect(rankResults(rows, 'first').map(r => r.seat)).toEqual([3, 1, 2, 0])
    expect(rankResults(rows, 'fewest').map(r => r.seat)).toEqual([3, 1, 2, 0])
    rows[1]!.moves = 3
    expect(rankResults(rows, 'fewest').map(r => r.seat)).toEqual([1, 3, 2, 0])
  })
})

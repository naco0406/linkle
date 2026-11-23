import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, REVEAL, ROOM_PROTOCOL, type Puzzle, type ServerMessage } from '@linkle/core'
import { createSaved, RoomCore, type Deps, type Step } from './room-core.ts'

const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const puzzle: Puzzle = { id: 7, kind: 'random', number: 3, date: null, start: { id: 1, title: '고려청자' }, end: { id: 2, title: '르네상스' } }

function room(over: Partial<Deps> = {}) {
  let t = 1_000_000
  let tok = 0
  const deps: Deps = {
    now: () => t,
    token: () => `tok${tok++}`,
    seed: () => 42,
    peek: async () => ({ card: { id: 9, kind: 'official', number: 9, difficulty: 'easy' }, authorId: null }),
    pick: async () => ({ puzzle, card: { id: 7, kind: 'random', number: 3, difficulty: 'normal' }, authorId: null }),
    createRuns: async (_p, racers) => Object.fromEntries(racers.map(r => [r.seat, `run-${r.seat}`])),
    ...over,
  }
  const core = new RoomCore(createSaved('K7PX'), deps)
  const join = (n: number) => {
    const r = core.join({ t: 'hello', v: ROOM_PROTOCOL, playerId: P(n), salt: 0 })
    if ('error' in r) throw new Error(r.error)
    return r.seat
  }
  return { core, join, advance: (ms: number) => (t += ms), now: () => t }
}
const msgs = (s: Step, t: ServerMessage['t']) => s.out.filter(o => o.msg.t === t).map(o => o.msg)

describe('같이 달리기 방', () => {
  it('처음 들어온 사람이 방장이고, 같은 기기는 같은 자리로 돌아온다', () => {
    const { core, join } = room()
    expect(join(1)).toBe(0)
    expect(join(2)).toBe(1)
    expect(join(1)).toBe(0)
    expect(core.view().seats.find(s => s.seat === 0)?.host).toBe(true)
  })

  it('준비한 사람이 2명 넘어야 출발하고, 방장만 출발할 수 있다', async () => {
    const { core, join } = room()
    join(1)
    join(2)
    expect(msgs(await core.handle(0, { t: 'start' }), 'error')).toEqual([{ t: 'error', code: 'not_enough' }])
    await core.handle(1, { t: 'ready', ready: true })
    expect(msgs(await core.handle(1, { t: 'start' }), 'error')).toEqual([{ t: 'error', code: 'not_host' }])
    const s = await core.handle(0, { t: 'start' })
    const starts = msgs(s, 'start') as Extract<ServerMessage, { t: 'start' }>[]
    expect(starts).toHaveLength(2)
    expect(starts.map(m => m.runId).sort()).toEqual(['run-0', 'run-1'])
    expect(starts[0]!.startsAt - starts[0]!.serverNow).toBe(REVEAL.go)
    expect(core.s.status).toBe('racing')
  })

  it('먼저 도착 방식은 첫 도착에서 판이 끝나고, 나머지는 가까웠던 순이다', async () => {
    const { core, join, advance } = room()
    for (const n of [1, 2, 3]) join(n)
    await core.handle(1, { t: 'ready', ready: true })
    await core.handle(2, { t: 'ready', ready: true })
    await core.handle(0, { t: 'start' })
    advance(REVEAL.go + 1000)
    await core.handle(1, { t: 'move', moves: 2, back: false, level: 1, title: '도자기', at: 900 })
    await core.handle(2, { t: 'move', moves: 3, back: false, level: 3, title: '이탈리아', at: 900 })
    const s = await core.handle(0, { t: 'arrive', moves: 4, at: 1000, pageId: 2 })
    const ended = msgs(s, 'ended')[0] as Extract<ServerMessage, { t: 'ended' }>
    expect(ended.reason).toBe('first')
    expect(ended.results.map(r => r.seat)).toEqual([0, 2, 1])
    expect(ended.results[1]).toMatchObject({ ms: null, level: 3, title: '이탈리아', state: 'stopped' })
    expect(core.view().seats.find(x => x.seat === 0)?.wins).toBe(1)
  })

  it('적은 이동 방식은 모두 끝날 때까지 달리고, 이동이 적은 쪽이 이긴다', async () => {
    const { core, join, advance } = room()
    join(1)
    join(2)
    await core.handle(0, { t: 'rules', rules: { win: 'fewest' } })
    await core.handle(1, { t: 'ready', ready: true })
    await core.handle(0, { t: 'start' })
    advance(REVEAL.go + 60_000)
    const first = await core.handle(0, { t: 'arrive', moves: 6, at: 30_000, pageId: 2 })
    expect(msgs(first, 'ended')).toHaveLength(0)
    const s = await core.handle(1, { t: 'arrive', moves: 4, at: 59_000, pageId: 2 })
    const ended = msgs(s, 'ended')[0] as Extract<ServerMessage, { t: 'ended' }>
    expect(ended.results.map(r => r.seat)).toEqual([1, 0])
  })

  it('다른 문서로 도착했다고 하면 받지 않는다', async () => {
    const { core, join, advance } = room()
    join(1)
    join(2)
    await core.handle(1, { t: 'ready', ready: true })
    await core.handle(0, { t: 'start' })
    advance(REVEAL.go + 10)
    expect(msgs(await core.handle(1, { t: 'arrive', moves: 2, at: 5, pageId: 99 }), 'error')).toHaveLength(1)
    expect(core.s.status).toBe('racing')
  })

  it('내가 낸 문제를 고르면 방장은 달리지 않고 지켜보며, 문서 이름은 지켜보는 자리에만 간다', async () => {
    const { core, join, advance } = room({ peek: async () => ({ card: { id: 9, kind: 'community', number: 2, difficulty: null }, authorId: P(1) }) })
    for (const n of [1, 2, 3]) join(n)
    await core.handle(0, { t: 'rules', rules: { source: 'mine', puzzleId: 9 } })
    await core.handle(1, { t: 'ready', ready: true })
    await core.handle(2, { t: 'ready', ready: true })
    const s = await core.handle(0, { t: 'start' })
    const mine = msgs(s, 'start').find((_, i) => s.out.filter(o => o.msg.t === 'start')[i]!.to === 0) as Extract<ServerMessage, { t: 'start' }>
    expect(mine.runId).toBeNull()
    expect(core.seatOf(0)?.role).toBe('watch')
    advance(REVEAL.go)
    const moved = await core.handle(1, { t: 'move', moves: 1, back: false, level: 2, title: '조선', at: 10 })
    expect(moved.out.find(o => o.msg.t === 'watch')?.to).toBe('watchers')
    expect(JSON.stringify(moved.out.find(o => o.msg.t === 'progress'))).not.toContain('조선')
  })

  it('정원이 차거나 판이 도는 중에 온 사람은 지켜보기로 받고, 다음 판에 자리가 나면 달린다', async () => {
    const { core, join } = room()
    for (let n = 1; n <= 9; n++) join(n)
    expect(core.seatOf(8)?.role).toBe('spectator')
    await core.handle(1, { t: 'leave' })
    await core.handle(2, { t: 'ready', ready: true })
    await core.handle(0, { t: 'start' })
    await core.handle(0, { t: 'giveup' })
    await core.handle(2, { t: 'giveup' })
    expect(core.s.status).toBe('results')
    await core.handle(0, { t: 'again' })
    expect(core.seatOf(8)?.role).toBe('player')
  })

  it('랜덤은 이미 낸 문제와 달리는 사람이 풀어 본 문제를 피해 뽑는다', async () => {
    let excluded: number[] = []
    const { core } = room({ pick: async (_r, ex) => ((excluded = ex), { puzzle, card: { id: 7, kind: 'random', number: 3, difficulty: 'normal' }, authorId: null }) })
    core.join({ t: 'hello', v: ROOM_PROTOCOL, playerId: P(1), salt: 0, solved: [11, 12] })
    core.join({ t: 'hello', v: ROOM_PROTOCOL, playerId: P(2), salt: 0, solved: [13] })
    await core.handle(1, { t: 'ready', ready: true })
    await core.handle(0, { t: 'start' })
    expect(excluded.sort()).toEqual([11, 12, 13])
    expect(core.s.rules).toEqual(DEFAULT_RULES)
  })

  it('시간이 다 되면 알람이 판을 끝낸다', async () => {
    const { core, join, advance } = room()
    join(1)
    join(2)
    await core.handle(1, { t: 'ready', ready: true })
    const s = await core.handle(0, { t: 'start' })
    expect(s.alarm).toBe(core.s.endsAt)
    advance(REVEAL.go + 10 * 60_000)
    expect((msgs(core.alarm(), 'ended')[0] as Extract<ServerMessage, { t: 'ended' }>).reason).toBe('time')
  })
})

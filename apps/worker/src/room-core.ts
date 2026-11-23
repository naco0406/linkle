import {
  DEFAULT_RULES,
  MAX_RACERS,
  MAX_SPECTATORS,
  nicknameOf,
  rankResults,
  REACTION_GAP_MS,
  RESPIN_BEFORE_GO_MS,
  REVEAL,
  ROOM_PROTOCOL,
  SEAT_HOLD_MS,
  type ClientMessage,
  type Progress,
  type Puzzle,
  type PuzzleCardLite,
  type RacerState,
  type ResultRow,
  type Role,
  type RoomError,
  type RoomView,
  type Rules,
  type ServerMessage,
} from '@linkle/core'

// 같이 달리기 방의 규칙(설계 문서 16.3). 소켓도 저장소도 모르는 순수한 상태 기계라 Worker 없이 테스트한다.
// 방(room.ts의 Durable Object)은 메시지를 넘기고, 돌려받은 Step대로 보내고 저장한다.
//
// 저장하는 것은 방(자리, 규칙, 판, 도착)뿐이다. 이동할 때마다 오는 진행(몇 번째, 색, 지금 문서)은 저장하지 않고
// 소켓에 붙여 둔다(live). 잠들었다 깨면 방이 소켓에서 다시 모아 준다. 저장소 쓰기를 아끼려는 것이다(16.3.7).

export type SeatSaved = {
  seat: number
  token: string
  playerId: string
  salt: number
  name: string
  role: Role
  ready: boolean
  /** 이 기기가 끝낸 문제들(랜덤에서 피하고, 고른 문제에 "풀어 봤어요"를 붙인다) */
  solved: number[]
  wins: number
  /** 이번 판을 달리는지 */
  racing: boolean
  /** 끊긴 때. 연결돼 있으면 null */
  leftAt: number | null
}

export type Saved = {
  code: string
  status: 'lobby' | 'racing' | 'results'
  round: number
  rules: Rules
  host: number
  nextSeat: number
  seats: SeatSaved[]
  kicked: string[]
  picked: PuzzleCardLite | null
  puzzle: Puzzle | null
  pickedAuthor: string | null
  seed: number
  startsAt: number
  endsAt: number | null
  respun: boolean
  used: number[]
  runIds: Record<string, string>
  arrivals: { seat: number; ms: number; moves: number }[]
  /** 판이 끝날 때 남긴 각자의 마지막 상태 */
  results: ResultRow[] | null
  endReason: 'first' | 'all' | 'time' | null
}

export type Live = { moves: number; state: RacerState; level: number | null; title: string | null; away: boolean }

export type Out = { to: number | 'all' | 'watchers'; msg: ServerMessage }
export type Step = { out: Out[]; persist: boolean; close?: { seat: number; code: number; reason: string }[]; alarm?: number | null }

export type Deps = {
  now(): number
  token(): string
  seed(): number
  /** 고른 문제를 확인해 카드와 함께 돌려준다. 이 방에서 낼 수 없는 문제면 null */
  peek(rules: Rules, hostPlayerId: string): Promise<{ card: PuzzleCardLite; authorId: string | null } | null>
  /** 낼 문제. 랜덤이면 exclude를 피해 뽑는다 */
  pick(rules: Rules, exclude: number[], hostPlayerId: string): Promise<{ puzzle: Puzzle; card: PuzzleCardLite; authorId: string | null } | null>
  /** 달리는 사람마다 판을 만든다(D1 runs). 시작 시각은 출발 시각이다 */
  createRuns(puzzle: Puzzle, racers: { seat: number; playerId: string; salt: number }[], startsAt: number, tag: string): Promise<Record<number, string>>
}

const step = (out: Out[] = [], persist = false, extra: Partial<Step> = {}): Step => ({ out, persist, ...extra })
const err = (seat: number, code: RoomError): Step => step([{ to: seat, msg: { t: 'error', code } }])

export function createSaved(code: string): Saved {
  return {
    code,
    status: 'lobby',
    round: 0,
    rules: { ...DEFAULT_RULES },
    host: -1,
    nextSeat: 0,
    seats: [],
    kicked: [],
    picked: null,
    puzzle: null,
    pickedAuthor: null,
    seed: 0,
    startsAt: 0,
    endsAt: null,
    respun: false,
    used: [],
    runIds: {},
    arrivals: [],
    results: null,
    endReason: null,
  }
}

export class RoomCore {
  readonly live = new Map<number, Live>()
  private lastReact = new Map<number, number>()

  constructor(
    readonly s: Saved,
    private deps: Deps,
  ) {}

  seatOf(n: number): SeatSaved | undefined {
    return this.s.seats.find(x => x.seat === n)
  }

  private get racers(): SeatSaved[] {
    return this.s.seats.filter(x => x.racing)
  }

  liveOf(n: number): Live {
    let l = this.live.get(n)
    if (!l) {
      l = { moves: 0, state: 'idle', level: null, title: null, away: false }
      this.live.set(n, l)
    }
    return l
  }

  view(): RoomView {
    const solvedPicked = this.s.picked?.id
    return {
      code: this.s.code,
      status: this.s.status,
      round: this.s.round,
      rules: this.s.rules,
      picked: this.s.picked,
      seats: this.s.seats.map(x => ({
        seat: x.seat,
        name: x.name,
        role: x.role,
        ready: x.ready,
        connected: x.leftAt === null,
        host: x.seat === this.s.host,
        solved: solvedPicked !== undefined && x.solved.includes(solvedPicked),
        wins: x.wins,
      })),
    }
  }

  progress(): Progress[] {
    return this.racers.map(x => {
      const l = this.liveOf(x.seat)
      return { seat: x.seat, moves: l.moves, state: l.state, level: l.level, away: l.away || x.leftAt !== null }
    })
  }

  /** 링크로 온 사람이 들어가기 전에 보는 방 정보(참가 확인, 16.3.1). 이름은 자동 이름이라 보여도 된다 */
  info(now: number): { status: Saved['status']; players: number; joinable: boolean; full: boolean; host: string | null; names: string[]; rules: Rules } {
    const live = this.s.seats.filter(x => !(x.leftAt !== null && now - x.leftAt > SEAT_HOLD_MS))
    const players = live.filter(x => x.role !== 'spectator')
    return {
      status: this.s.status,
      players: players.length,
      joinable: live.length < MAX_RACERS + MAX_SPECTATORS,
      full: players.length >= MAX_RACERS,
      host: this.seatOf(this.s.host)?.name ?? null,
      names: players.map(x => x.name),
      rules: this.s.rules,
    }
  }

  private roomAll(): Out {
    return { to: 'all', msg: { t: 'room', room: this.view() } }
  }

  /** 새 연결의 hello. 같은 토큰이나 같은 기기면 그 자리로 돌아온다 */
  join(m: Extract<ClientMessage, { t: 'hello' }>): { seat: number; step: Step } | { error: RoomError } {
    const now = this.deps.now()
    if (m.v !== ROOM_PROTOCOL) return { error: 'version' }
    if (this.s.kicked.includes(m.playerId)) return { error: 'kicked' }
    let seat = this.s.seats.find(x => (m.token && x.token === m.token) || x.playerId === m.playerId)
    if (seat) {
      seat.leftAt = null
      seat.solved = m.solved ?? seat.solved
      if (seat.salt !== m.salt) {
        seat.salt = m.salt
        seat.name = nicknameOf(m.playerId, m.salt)
      }
      // 달리던 중에 끊겼다 다시 왔다. 진행은 기기가 갖고 있다
      if (seat.racing && m.progress) Object.assign(this.liveOf(seat.seat), m.progress)
    } else {
      // 오래 비운 자리는 새 사람에게 넘긴다(대기실에서만)
      if (this.s.status === 'lobby') this.s.seats = this.s.seats.filter(x => !(x.leftAt !== null && now - x.leftAt > SEAT_HOLD_MS && x.seat !== this.s.host))
      const players = this.s.seats.filter(x => x.role !== 'spectator').length
      const spectators = this.s.seats.length - players
      // 정원이 찼거나 판이 진행 중이면 지켜보기로 받는다(16.7)
      const role: Role = players < MAX_RACERS && this.s.status === 'lobby' ? 'player' : 'spectator'
      if (role === 'spectator' && spectators >= MAX_SPECTATORS) return { error: 'full' }
      seat = { seat: this.s.nextSeat++, token: this.deps.token(), playerId: m.playerId, salt: m.salt, name: nicknameOf(m.playerId, m.salt), role, ready: false, solved: m.solved ?? [], wins: 0, racing: false, leftAt: null }
      this.s.seats.push(seat)
      if (this.s.host < 0 || !this.seatOf(this.s.host)) this.s.host = seat.seat
    }
    const welcome: Out = { to: seat.seat, msg: { t: 'welcome', seat: seat.seat, token: seat.token, room: this.view(), serverNow: now } }
    const out: Out[] = [welcome, this.roomAll()]
    // 판 중에 들어오거나 돌아온 사람에게 지금 판을 다시 알려 준다
    if (this.s.status !== 'lobby' && this.s.puzzle) out.push({ to: seat.seat, msg: this.startMsg(seat) })
    if (this.s.status === 'racing') out.push({ to: seat.seat, msg: { t: 'progress', list: this.progress() } })
    if (this.s.status === 'results' && this.s.results) out.push({ to: seat.seat, msg: { t: 'ended', round: this.s.round, reason: this.s.endReason ?? 'all', results: this.s.results } })
    return { seat: seat.seat, step: step(out, true) }
  }

  private startMsg(seat: SeatSaved): ServerMessage {
    const p = this.s.puzzle!
    return {
      t: 'start',
      round: this.s.round,
      puzzle: p,
      seed: this.s.seed,
      revealAt: this.s.startsAt - REVEAL.go + REVEAL.end,
      startsAt: this.s.startsAt,
      endsAt: this.s.endsAt,
      runId: seat.racing ? (this.s.runIds[String(seat.seat)] ?? null) : null,
      serverNow: this.deps.now(),
    }
  }

  disconnect(n: number): Step {
    const seat = this.seatOf(n)
    if (!seat) return step()
    seat.leftAt = this.deps.now()
    return step([this.roomAll()], true)
  }

  async handle(n: number, m: ClientMessage): Promise<Step> {
    const seat = this.seatOf(n)
    if (!seat) return err(n, 'bad_state')
    const now = this.deps.now()
    const host = n === this.s.host
    switch (m.t) {
      case 'hello':
        return err(n, 'bad_state')
      case 'ready':
        if (this.s.status !== 'lobby' || seat.role === 'spectator') return err(n, 'bad_state')
        seat.ready = m.ready
        return step([this.roomAll()], true)
      case 'rules': {
        if (!host) return err(n, 'not_host')
        if (this.s.status !== 'lobby') return err(n, 'bad_state')
        const next: Rules = { ...this.s.rules, ...m.rules }
        if (m.rules.source && m.rules.source !== this.s.rules.source && m.rules.puzzleId === undefined) next.puzzleId = null
        if (next.source === 'random') next.puzzleId = null
        if (next.source !== 'random' && next.puzzleId !== null) {
          const peeked = await this.deps.peek(next, seat.playerId)
          if (!peeked) return err(n, 'no_puzzle')
          this.s.picked = peeked.card
          this.s.pickedAuthor = peeked.authorId
        } else {
          this.s.picked = null
          this.s.pickedAuthor = null
        }
        this.s.rules = next
        return step([this.roomAll()], true)
      }
      case 'start':
        return this.start(seat)
      case 'respin': {
        if (!host) return err(n, 'not_host')
        if (this.s.status !== 'racing' || this.s.rules.source !== 'random' || this.s.respun || now > this.s.startsAt - RESPIN_BEFORE_GO_MS) return err(n, 'bad_state')
        this.s.respun = true
        return this.launch(seat, true)
      }
      case 'move': {
        if (this.s.status !== 'racing' || !seat.racing) return step()
        const l = this.liveOf(n)
        if (l.state === 'arrived' || l.state === 'gaveup' || l.state === 'stopped') return step()
        Object.assign(l, { moves: m.moves, state: m.back ? 'back' : 'move', level: m.level, title: m.title })
        const out: Out[] = [{ to: 'all', msg: { t: 'progress', list: this.progress() } }]
        // 출제자(지켜보는 자리)에게만 문서 이름이 간다(16.3.5)
        out.push({ to: 'watchers', msg: { t: 'watch', seat: n, title: m.title, moves: m.moves, level: m.level } })
        return step(out)
      }
      case 'arrive': {
        if (this.s.status !== 'racing' || !seat.racing || !this.s.puzzle) return step()
        if (m.pageId !== this.s.puzzle.end.id || now < this.s.startsAt) return err(n, 'bad_request')
        const l = this.liveOf(n)
        if (l.state === 'arrived') return step()
        // 시간은 서버가 잰 값보다 길 수 없다. 끊긴 사이에 도착했으면 기기가 잰 값을 쓴다(5.3과 같은 규칙)
        const ms = Math.max(0, Math.min(m.at, now - this.s.startsAt))
        Object.assign(l, { moves: m.moves, state: 'arrived', level: null, title: this.s.puzzle.end.title })
        const arrival = { seat: n, ms, moves: m.moves }
        this.s.arrivals.push(arrival)
        const out: Out[] = [
          { to: 'all', msg: { t: 'arrived', arrival } },
          { to: 'all', msg: { t: 'progress', list: this.progress() } },
        ]
        if (this.s.rules.win === 'first') return this.end('first', out)
        if (this.allDone()) return this.end('all', out)
        return step(out, true)
      }
      case 'giveup': {
        if (this.s.status !== 'racing' || !seat.racing) return step()
        const l = this.liveOf(n)
        if (l.state === 'arrived') return step()
        l.state = 'gaveup'
        const out: Out[] = [{ to: 'all', msg: { t: 'progress', list: this.progress() } }]
        if (this.allDone()) return this.end(this.s.arrivals.length ? 'all' : 'all', out)
        return step(out)
      }
      case 'away': {
        if (!seat.racing) return step()
        this.liveOf(n).away = m.away
        return step([{ to: 'all', msg: { t: 'progress', list: this.progress() } }])
      }
      case 'react': {
        const last = this.lastReact.get(n) ?? 0
        // 망이 몰아서 보낼 수 있어 간격의 절반까지는 받는다
        if (now - last < REACTION_GAP_MS / 2) return step()
        this.lastReact.set(n, now)
        return step([{ to: 'all', msg: { t: 'react', seat: n, id: m.id } }])
      }
      case 'log':
        if (m.round !== this.s.round || this.s.status !== 'results') return step()
        return step([{ to: 'all', msg: { t: 'log', seat: n, round: m.round, entries: m.entries } }])
      case 'kick': {
        if (!host) return err(n, 'not_host')
        if (this.s.status === 'racing' || m.seat === n) return err(n, 'bad_state')
        const target = this.seatOf(m.seat)
        if (!target) return err(n, 'bad_state')
        this.s.kicked.push(target.playerId)
        this.s.seats = this.s.seats.filter(x => x.seat !== m.seat)
        return step([{ to: m.seat, msg: { t: 'error', code: 'kicked' } }, this.roomAll()], true, { close: [{ seat: m.seat, code: 1008, reason: 'kicked' }] })
      }
      case 'again': {
        if (this.s.status !== 'results') return step()
        this.toLobby()
        seat.ready = seat.role !== 'spectator'
        return step([this.roomAll()], true)
      }
      case 'leave': {
        this.s.seats = this.s.seats.filter(x => x.seat !== n)
        if (this.s.host === n) this.s.host = this.s.seats.find(x => x.leftAt === null)?.seat ?? this.s.seats[0]?.seat ?? -1
        const out: Out[] = [this.roomAll()]
        if (this.s.status === 'racing' && seat.racing && this.allDone()) return this.end('all', out, { close: [{ seat: n, code: 1000, reason: 'left' }] })
        return step(out, true, { close: [{ seat: n, code: 1000, reason: 'left' }] })
      }
    }
  }

  private toLobby(): void {
    this.s.status = 'lobby'
    this.s.puzzle = null
    this.s.results = null
    this.s.endReason = null
    this.s.arrivals = []
    this.s.runIds = {}
    this.s.respun = false
    // 다음 판에 낼 문제는 다시 고른다. 같은 문제를 두 번 내지 않는다
    if (this.s.rules.source !== 'random') {
      this.s.rules = { ...this.s.rules, puzzleId: null }
      this.s.picked = null
      this.s.pickedAuthor = null
    }
    this.live.clear()
    let players = this.s.seats.filter(x => x.role !== 'spectator').length
    for (const x of this.s.seats) {
      x.racing = false
      x.ready = false
      if (x.role === 'watch') x.role = 'player'
      // 자리가 나면 지켜보던 사람도 다음 판부터 함께 달린다
      if (x.role === 'spectator' && players < MAX_RACERS && x.leftAt === null) {
        x.role = 'player'
        players++
      }
    }
  }

  private allDone(): boolean {
    return this.racers.every(x => {
      const st = this.liveOf(x.seat).state
      return st === 'arrived' || st === 'gaveup' || (x.leftAt !== null && this.deps.now() - x.leftAt > SEAT_HOLD_MS)
    })
  }

  private async start(seat: SeatSaved): Promise<Step> {
    if (seat.seat !== this.s.host) return err(seat.seat, 'not_host')
    if (this.s.status !== 'lobby') return err(seat.seat, 'bad_state')
    return this.launch(seat, false)
  }

  /** 문제를 정하고 판을 만든다. 다시 돌리기도 여기로 온다 */
  private async launch(hostSeat: SeatSaved, respin: boolean): Promise<Step> {
    const now = this.deps.now()
    const rules = this.s.rules
    if (!respin) {
      // 내가 낸 문제면 출제자(방장)는 달리지 않고 지켜본다
      const mine = rules.source === 'mine'
      for (const x of this.s.seats) x.racing = x.role !== 'spectator' && x.leftAt === null && (x.ready || x.seat === hostSeat.seat) && !(mine && x.seat === hostSeat.seat)
      if (mine) hostSeat.role = 'watch'
      if (this.racers.length < 2) {
        if (mine) hostSeat.role = 'player'
        for (const x of this.s.seats) x.racing = false
        return err(hostSeat.seat, 'not_enough')
      }
    }
    const exclude = [...new Set([...this.s.used, ...this.racers.flatMap(x => x.solved)])]
    const picked = await this.deps.pick(rules, exclude, hostSeat.playerId)
    if (!picked) {
      if (!respin) {
        if (hostSeat.role === 'watch') hostSeat.role = 'player'
        for (const x of this.s.seats) x.racing = false
      }
      return err(hostSeat.seat, 'no_puzzle')
    }
    if (!respin) this.s.round++
    const startsAt = now + REVEAL.go
    const runIds = await this.deps.createRuns(
      picked.puzzle,
      this.racers.map(x => ({ seat: x.seat, playerId: x.playerId, salt: x.salt })),
      startsAt,
      `${this.s.code}:${this.s.round}`,
    )
    this.s.status = 'racing'
    this.s.puzzle = picked.puzzle
    this.s.picked = picked.card
    this.s.pickedAuthor = picked.authorId
    this.s.seed = this.deps.seed()
    this.s.startsAt = startsAt
    this.s.endsAt = rules.limit > 0 ? startsAt + rules.limit * 60_000 : null
    this.s.used = [...this.s.used, picked.puzzle.id].slice(-200)
    this.s.runIds = Object.fromEntries(Object.entries(runIds).map(([k, v]) => [String(k), v]))
    this.s.arrivals = []
    this.live.clear()
    for (const x of this.racers) this.liveOf(x.seat)
    const out: Out[] = [this.roomAll(), ...this.s.seats.map(x => ({ to: x.seat, msg: this.startMsg(x) }) as Out), { to: 'all', msg: { t: 'progress', list: this.progress() } }]
    return step(out, true, { alarm: this.s.endsAt })
  }

  /** 예약 알람. 시간이 다 됐으면 판을 끝낸다 */
  alarm(): Step {
    if (this.s.status === 'racing' && this.s.endsAt !== null && this.deps.now() >= this.s.endsAt - 500) return this.end('time', [])
    return step()
  }

  private end(reason: 'first' | 'all' | 'time', out: Out[], extra: Partial<Step> = {}): Step {
    const arrivals = new Map(this.s.arrivals.map(a => [a.seat, a]))
    const rows: ResultRow[] = this.racers.map(x => {
      const l = this.liveOf(x.seat)
      const a = arrivals.get(x.seat)
      const state: RacerState = a ? 'arrived' : l.state === 'gaveup' ? 'gaveup' : 'stopped'
      return { seat: x.seat, name: x.name, ms: a?.ms ?? null, moves: a?.moves ?? l.moves, level: a ? null : l.level, title: l.title, state }
    })
    const results = rankResults(rows, this.s.rules.win)
    const winner = results[0]?.ms !== null ? results[0] : undefined
    if (winner) {
      const w = this.seatOf(winner.seat)
      if (w) w.wins++
    }
    for (const x of this.racers) {
      const l = this.liveOf(x.seat)
      if (l.state !== 'arrived' && l.state !== 'gaveup') l.state = 'stopped'
    }
    this.s.status = 'results'
    this.s.results = results
    this.s.endReason = reason
    return step([...out, { to: 'all', msg: { t: 'ended', round: this.s.round, reason, results } }, this.roomAll()], true, { alarm: null, ...extra })
  }
}

// ── 방이 낼 문제(D1의 puzzles 한 줄) ──

export type PuzzleRow = {
  id: number
  kind: Puzzle['kind']
  number: number
  date: string | null
  start_id: number
  start_title: string
  end_id: number
  end_title: string
  status: string
  author_id: string | null
  difficulty: 'easy' | 'normal' | 'hard' | null
}
export const COLS = 'id, kind, number, date, start_id, start_title, end_id, end_title, status, author_id, difficulty'
export const toPuzzle = (r: PuzzleRow): Puzzle => ({ id: r.id, kind: r.kind, number: r.number, date: r.date, start: { id: r.start_id, title: r.start_title }, end: { id: r.end_id, title: r.end_title } })
export const toCard = (r: PuzzleRow): PuzzleCardLite => ({ id: r.id, kind: r.kind, number: r.number, difficulty: r.difficulty })

/** 방장이 고른 문제가 이 방에서 낼 수 있는 문제인지. 오늘과 앞으로의 오늘의 문제는 안 된다 */
export function allowed(row: PuzzleRow, rules: Rules, hostPlayerId: string, today: string): boolean {
  if (rules.source === 'archive') return row.kind === 'daily' && row.status === 'published' && !!row.date && row.date < today
  if (rules.source === 'community') return (row.kind === 'official' || row.kind === 'community') && row.status === 'published'
  if (rules.source === 'mine') return row.kind === 'community' && row.author_id === hostPlayerId && (row.status === 'unlisted' || row.status === 'published')
  return false
}

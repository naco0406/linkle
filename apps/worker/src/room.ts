import { DurableObject } from 'cloudflare:workers'
import { kstDate, parseClientMessage, type Puzzle, type Rules, type ServerMessage } from '@linkle/core'
import { startRun } from './db.ts'
import { allowed, COLS, createSaved, RoomCore, toCard, toPuzzle, type Live, type PuzzleRow, type Saved, type Step } from './room-core.ts'
import { runKindFor } from './rules.ts'

// 같이 달리기 방 하나 = Durable Object 하나(설계 문서 16.3.7). 이름은 방 코드다.
// usagi-volleyball의 방 서버를 따랐다: Hibernation API로 소켓을 받아, 기다리는 동안은 실행 시간 요금이 없다.
// 방(자리, 규칙, 판)만 저장소에 쓰고, 이동마다 오는 진행은 소켓에 붙여 둔다(serializeAttachment).

/** 아무도 연결돼 있지 않은 방은 이만큼 뒤에 지운다 */
export const IDLE_MS = 30 * 60 * 1000
const PING = 'ping'
const PONG = 'pong'

export type RoomEnv = { DB: D1Database }
type Attachment = { seat: number | null; live?: Live }

export class Room extends DurableObject<RoomEnv> {
  private core: RoomCore | null = null

  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env)
    // keep-alive는 방을 깨우지 않고 런타임이 답한다
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG))
  }

  private deps() {
    const db = this.env.DB
    return {
      now: () => Date.now(),
      token: () => crypto.randomUUID(),
      seed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
      peek: async (rules: Rules, host: string) => {
        if (rules.puzzleId === null) return null
        const row = await db.prepare(`SELECT ${COLS} FROM puzzles WHERE id = ?1`).bind(rules.puzzleId).first<PuzzleRow>()
        return row && allowed(row, rules, host, kstDate(Date.now())) ? { card: toCard(row), authorId: row.author_id } : null
      },
      pick: async (rules: Rules, exclude: number[], host: string) => {
        if (rules.source !== 'random') {
          if (rules.puzzleId === null) return null
          const row = await db.prepare(`SELECT ${COLS} FROM puzzles WHERE id = ?1`).bind(rules.puzzleId).first<PuzzleRow>()
          return row && allowed(row, rules, host, kstDate(Date.now())) ? { puzzle: toPuzzle(row), card: toCard(row), authorId: row.author_id } : null
        }
        // 랜덤 풀에서 이 방이 아직 안 낸 것, 달리는 사람 아무도 안 풀어 본 것을 먼저. 그 난이도가 없으면 다른 난이도에서.
        // 랜덤 풀이 비었으면(처음 배포했을 때, 채우기가 도는 중) 링클이 낸 커뮤니티 문제에서 뽑는다. 같은 검사를 거친 문제다
        const pickFrom = (kind: 'random' | 'official', difficulty: string | null) =>
          db
            .prepare(
              `SELECT ${COLS} FROM puzzles WHERE kind = ?3 AND status = 'published' AND (?1 IS NULL OR difficulty = ?1)
               AND id NOT IN (SELECT value FROM json_each(?2)) ORDER BY RANDOM() LIMIT 1`,
            )
            .bind(difficulty, JSON.stringify(exclude), kind)
            .first<PuzzleRow>()
        const row =
          (await pickFrom('random', rules.difficulty)) ?? (await pickFrom('random', null)) ?? (await pickFrom('official', rules.difficulty)) ?? (await pickFrom('official', null))
        return row ? { puzzle: toPuzzle(row), card: toCard(row), authorId: null } : null
      },
      createRuns: async (puzzle: Puzzle, racers: { seat: number; playerId: string; salt: number }[], startsAt: number, tag: string) => {
        const stored = await db.prepare(`SELECT status, author_id FROM puzzles WHERE id = ?1`).bind(puzzle.id).first<{ status: string; author_id: string | null }>()
        const out: Record<number, string> = {}
        for (const r of racers) {
          const kind = runKindFor({ kind: puzzle.kind, date: puzzle.date, status: stored?.status ?? 'published', authorId: stored?.author_id ?? null }, kstDate(Date.now()), r.playerId)
          if (!kind) continue
          // 시작 시각은 출발 시각이다. 기록의 시간이 공개 연출을 빼고 잰 값이 된다
          const run = await startRun(db, { puzzleId: puzzle.id, playerId: r.playerId, kind, now: startsAt, room: tag, salt: r.salt })
          out[r.seat] = run.runId
        }
        return out
      },
    }
  }

  /** 깨어나면 방을 읽고, 소켓에 붙여 둔 진행을 다시 모은다 */
  private async load(): Promise<RoomCore | null> {
    if (this.core) return this.core
    const saved = await this.ctx.storage.get<Saved>('room')
    if (!saved) return null
    const core = new RoomCore(saved, this.deps())
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null
      if (a?.seat !== null && a?.seat !== undefined && a.live) core.live.set(a.seat, a.live)
    }
    this.core = core
    return core
  }

  /** Worker가 부른다: 새 방 코드로 방을 만든다. 이미 쓰는 코드면 false */
  async create(code: string): Promise<boolean> {
    const existing = await this.load()
    if (existing) return false
    const saved = createSaved(code)
    await this.ctx.storage.put('room', saved)
    this.core = new RoomCore(saved, this.deps())
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
    return true
  }

  async info(): Promise<ReturnType<RoomCore['info']> | null> {
    const core = await this.load()
    return core ? core.info(Date.now()) : null
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 })
    const core = await this.load()
    if (!core) return Response.json({ error: 'room_not_found' }, { status: 404 })
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ seat: null } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const core = await this.load()
    if (!core) {
      ws.close(1011, 'room gone')
      return
    }
    const msg = typeof raw === 'string' ? parseClientMessage(raw) : null
    const a = (ws.deserializeAttachment() as Attachment | null) ?? { seat: null }
    if (!msg) {
      this.send(ws, { t: 'error', code: 'bad_request' })
      return
    }
    if (a.seat === null) {
      if (msg.t !== 'hello') {
        this.send(ws, { t: 'error', code: 'bad_state' })
        return
      }
      const joined = core.join(msg)
      if ('error' in joined) {
        this.send(ws, { t: 'error', code: joined.error })
        ws.close(1008, joined.error)
        return
      }
      // 한 자리에는 연결 하나. 예전 탭은 내보낸다
      for (const other of this.socketsOf(joined.seat)) {
        if (other === ws) continue
        this.send(other, { t: 'error', code: 'replaced' })
        other.serializeAttachment({ seat: null } satisfies Attachment)
        other.close(4000, 'replaced')
      }
      ws.serializeAttachment({ seat: joined.seat, live: core.liveOf(joined.seat) } satisfies Attachment)
      await this.apply(joined.step)
      return
    }
    const s = await core.handle(a.seat, msg)
    // 진행이 바뀌었으면 소켓에 붙여 둔다(잠들어도 남는다)
    const live = core.live.get(a.seat)
    if (live) ws.serializeAttachment({ seat: a.seat, live } satisfies Attachment)
    await this.apply(s)
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye')
    } catch {
      // 이미 닫혔다
    }
    await this.dropped(ws)
  }

  async webSocketError(ws: WebSocket) {
    await this.dropped(ws)
  }

  private async dropped(ws: WebSocket) {
    const seat = (ws.deserializeAttachment() as Attachment | null)?.seat
    const core = await this.load()
    if (!core || seat === null || seat === undefined) return
    // 바뀐 탭이 닫히는 것은 끊김이 아니다
    if (this.socketsOf(seat).some(o => o !== ws)) return
    if (core.seatOf(seat)) await this.apply(core.disconnect(seat))
    if (!this.ctx.getWebSockets().some(o => o !== ws)) await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
  }

  /** 제한 시간이 끝났거나, 아무도 없는 방을 정리할 때 */
  async alarm() {
    const core = await this.load()
    if (!core) return
    await this.apply(core.alarm())
    const open = this.ctx.getWebSockets().length > 0
    if (core.s.status === 'racing' && core.s.endsAt !== null && core.s.endsAt > Date.now()) {
      await this.ctx.storage.setAlarm(core.s.endsAt)
      return
    }
    if (open) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
      return
    }
    await this.ctx.storage.deleteAll()
    this.core = null
  }

  private socketsOf(seat: number): WebSocket[] {
    return this.ctx.getWebSockets().filter(ws => (ws.deserializeAttachment() as Attachment | null)?.seat === seat)
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // 닫히는 중
    }
  }

  private async apply(s: Step) {
    const core = this.core
    for (const { to, msg } of s.out) {
      const sockets = this.ctx.getWebSockets().filter(ws => {
        const seat = (ws.deserializeAttachment() as Attachment | null)?.seat
        if (seat === null || seat === undefined) return false
        if (to === 'all') return true
        if (to === 'watchers') return core?.seatOf(seat)?.role === 'watch'
        return seat === to
      })
      for (const ws of sockets) this.send(ws, msg)
    }
    if (s.persist && core) await this.ctx.storage.put('room', core.s)
    for (const c of s.close ?? []) for (const ws of this.socketsOf(c.seat)) ws.close(c.code, c.reason)
    if (s.alarm !== undefined) {
      if (s.alarm !== null) await this.ctx.storage.setAlarm(s.alarm)
      else if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
    }
  }
}

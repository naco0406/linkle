import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createRun,
  ROOM_PROTOCOL,
  type Arrival,
  type ClientMessage,
  type LogEntry,
  type Progress,
  type Reaction,
  type RoomError,
  type RoomView,
  type ServerMessage,
} from '@linkle/core'
import { playerId, playerSalt } from './player'
import { runIn, solvedIds, useGame, type Slot } from './store'

// 같이 달리기 방과 주고받는다(설계 문서 16.3, 메시지는 @linkle/core room.ts).
// usagi-volleyball의 SDK처럼 끊기면 스스로 다시 붙고, 자리 토큰으로 같은 자리에 돌아온다.
// 판(Run)은 기기의 store에 'room:코드' 자리로 둔다. 이동 로그가 진실이고, 방에는 친구에게 보여 줄 요약만 보낸다.

export type StartInfo = Extract<ServerMessage, { t: 'start' }>
export type Ended = Extract<ServerMessage, { t: 'ended' }>
export type RoomState = {
  phase: 'connecting' | 'open' | 'closed'
  error: RoomError | 'network' | null
  seat: number | null
  room: RoomView | null
  start: StartInfo | null
  progress: Progress[]
  arrivals: Arrival[]
  /** 출제자 관전: 자리마다 지금 있는 문서 */
  watch: Record<number, { title: string; moves: number; level: number | null }>
  reacts: { seat: number; id: Reaction; key: number }[]
  ended: Ended | null
  logs: Record<number, LogEntry[]>
}

const INITIAL: RoomState = { phase: 'connecting', error: null, seat: null, room: null, start: null, progress: [], arrivals: [], watch: {}, reacts: [], ended: null, logs: {} }
const TOKEN_KEY = (code: string) => `linkle:room:${code}`
const RETRY_MS = [300, 1000, 2000, 4000]
const PING_MS = 20_000
/** 반응이 화면에 떠 있는 시간 */
const REACT_SHOW_MS = 2200

export const roomSlot = (code: string): Slot => `room:${code}`

export const CREATED = (code: string) => `linkle:room-created:${code}`

/** 방을 만든 사람은 확인 없이 바로 들어간다. 링크로 온 사람은 누구의 방인지 먼저 본다 */
export function markCreated(code: string) {
  try {
    sessionStorage.setItem(CREATED(code), '1')
  } catch {
    // 막혔으면 확인 화면을 한 번 더 본다
  }
}

function readToken(code: string): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY(code)) ?? undefined
  } catch {
    return undefined
  }
}

export function useRoom(code: string, enabled: boolean) {
  const [state, setState] = useState<RoomState>(INITIAL)
  const ws = useRef<WebSocket | null>(null)
  const queue = useRef<ClientMessage[]>([])

  const send = useCallback((msg: ClientMessage) => {
    const s = ws.current
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(msg))
    else if (msg.t !== 'move' && msg.t !== 'react' && msg.t !== 'away') queue.current.push(msg)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined
    const slot = roomSlot(code)

    const onMessage = (msg: ServerMessage) => {
      switch (msg.t) {
        case 'welcome':
          try {
            localStorage.setItem(TOKEN_KEY(code), msg.token)
          } catch {
            // 토큰을 못 남기면 같은 기기 id로 돌아온다
          }
          useGame.setState({ clockOffset: msg.serverNow - Date.now() })
          setState(s => ({ ...s, phase: 'open', error: null, seat: msg.seat, room: msg.room }))
          break
        case 'room':
          setState(s => ({ ...s, room: msg.room, ...(msg.room.status === 'lobby' ? { start: null, ended: null, progress: [], arrivals: [], watch: {}, logs: {} } : null) }))
          break
        case 'start': {
          const game = useGame.getState()
          const mine = runIn(game, slot)
          if (msg.runId && mine?.runId !== msg.runId) {
            const mode = msg.puzzle.kind === 'daily' ? 'archive' : 'community'
            game.begin(slot, { ...createRun({ mode, puzzle: msg.puzzle, runId: msg.runId, startedAt: msg.startsAt }), room: { code, round: msg.round } }, msg.serverNow)
          } else useGame.setState({ clockOffset: msg.serverNow - Date.now() })
          setState(s => ({ ...s, start: msg, ended: s.start?.round === msg.round && s.start.runId === msg.runId ? s.ended : null, arrivals: s.start?.round === msg.round ? s.arrivals : [], logs: {} }))
          break
        }
        case 'progress':
          setState(s => ({ ...s, progress: msg.list }))
          break
        case 'arrived':
          setState(s => ({ ...s, arrivals: [...s.arrivals.filter(a => a.seat !== msg.arrival.seat), msg.arrival] }))
          break
        case 'watch':
          setState(s => ({ ...s, watch: { ...s.watch, [msg.seat]: { title: msg.title, moves: msg.moves, level: msg.level } } }))
          break
        case 'react': {
          const key = Math.random()
          setState(s => ({ ...s, reacts: [...s.reacts.filter(r => r.seat !== msg.seat), { seat: msg.seat, id: msg.id, key }] }))
          setTimeout(() => setState(s => ({ ...s, reacts: s.reacts.filter(r => r.key !== key) })), REACT_SHOW_MS)
          break
        }
        case 'ended': {
          // 다른 사람이 먼저 도착했거나 시간이 끝났다. 내 판은 거기서 멈춘다
          const run = runIn(useGame.getState(), slot)
          if (run?.phase === 'playing' && run.room?.round === msg.round) useGame.getState().stop(slot, Date.now() + useGame.getState().clockOffset)
          setState(s => ({ ...s, ended: msg }))
          break
        }
        case 'log':
          setState(s => ({ ...s, logs: { ...s.logs, [msg.seat]: msg.entries } }))
          break
        case 'error':
          setState(s => ({ ...s, error: msg.code }))
          break
      }
    }

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws`)
      ws.current = socket
      socket.onopen = () => {
        attempt = 0
        const game = useGame.getState()
        const run = runIn(game, slot)
        const racing = run?.phase === 'playing' ? { moves: run.events.length, state: 'move' as const, level: null } : run?.phase === 'finished' && !run.stopped ? { moves: run.events.length, state: 'arrived' as const, level: null } : undefined
        socket.send(JSON.stringify({ t: 'hello', v: ROOM_PROTOCOL, playerId: playerId(), salt: playerSalt(), token: readToken(code), solved: solvedIds(game), progress: racing } satisfies ClientMessage))
        for (const m of queue.current.splice(0)) socket.send(JSON.stringify(m))
        ping = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), PING_MS)
      }
      socket.onmessage = e => {
        if (e.data === 'pong') return
        try {
          onMessage(JSON.parse(String(e.data)) as ServerMessage)
        } catch {
          // 모르는 메시지는 버린다
        }
      }
      socket.onclose = e => {
        clearInterval(ping)
        if (stopped) return
        // 내보내졌거나 다른 탭이 자리를 가져갔으면 다시 붙지 않는다
        if (e.code === 1008 || e.code === 4000) {
          setState(s => ({ ...s, phase: 'closed' }))
          return
        }
        setState(s => ({ ...s, phase: 'connecting' }))
        retry = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)])
        if (attempt > 6) setState(s => ({ ...s, error: s.error ?? 'network' }))
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      clearInterval(ping)
      ws.current?.close(1000, 'bye')
      ws.current = null
    }
  }, [code, enabled])

  return { state, send }
}

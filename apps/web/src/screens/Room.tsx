import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { encode } from 'uqr'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, Dices, Eye, Hourglass, ExternalLink, Repeat, ScanLine, Send, Share2, SmilePlus, Trophy, Users, X } from 'lucide-react'
import {
  animalOf,
  formatClock,
  isRoomCode,
  LEVEL_EMOJI,
  LIMIT_MINUTES,
  MAX_RACERS,
  normalizeRoomCode,
  REACTIONS,
  RESPIN_BEFORE_GO_MS,
  REVEAL,
  type ClientMessage,
  type LogEntry,
  type Progress,
  type Reaction,
  type ResultRow,
  type Rules,
  type Run,
  type SeatView,
} from '@linkle/core'
import { makeLead } from '@linkle/embed'
import { getArchive, getCommunity, getMine, getRoom, renamePlayer, type MineRow } from '../game/api'
import { getModel, levelFor } from '../game/emoji'
import { detectInApp, stayedHere, stayHere } from '../game/inApp'
import { loadPage } from '../game/pages'
import { myName, rerollSalt } from '../game/player'
import { reelAt, reelOf } from '../game/reel'
import { CREATED, roomSlot, useRoom, type RoomState } from '../game/room'
import { fetchSummary } from '../game/summary'
import { now, runIn, useGame, useImmersive } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, TextButton } from '../ui/cards'
import { Ava, EmojiSq, LevelSq, sendChallenge, useNow } from '../ui/Friends'
import { DifficultyChip, Segmented } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { QrScanner } from '../ui/QrScanner'
import { copyText } from '../ui/share'
import { Game } from './Game'
import { CardTitle, Notice, Skeleton } from './Yesterday'

// 같이 달리기 방(/room/:code, 설계 문서 16.3, 시안 docs/design/friend-race).
// 방의 단계(대기실 → 공개 → 달리기 → 결과)는 방이 정하고, 이 화면은 그것을 그린다.

const short = (name: string) => name.split(' ').slice(-2, -1)[0] ?? name
const numberOf = (name: string) => name.split(' ').at(-1) ?? ''

function wasHere(code: string): boolean {
  try {
    return sessionStorage.getItem(CREATED(code)) !== null || localStorage.getItem(`linkle:room:${code}`) !== null
  } catch {
    return false
  }
}

export function RoomPage() {
  const code = normalizeRoomCode(useParams().code ?? '')
  const valid = isRoomCode(code)
  const setImmersive = useImmersive(s => s.set)
  const inApp = useMemo(() => detectInApp(), [])
  const [stay, setStay] = useState(stayedHere)
  const [joined, setJoined] = useState(() => valid && wasHere(code))
  const { data: info, error } = useLoad(`room-info:${code}`, () => (valid ? getRoom(code) : Promise.reject(new Error('bad code'))))
  const { state, send } = useRoom(code, valid && joined && !!info)

  // 방 안에서는 아래 탭을 치운다. 친구와 노는 화면에 집중한다
  useEffect(() => {
    setImmersive(true)
    return () => setImmersive(false)
  }, [setImmersive])

  if (!valid || (error && !info)) return <Frame><Notice title="없는 방이에요" body="방 코드를 다시 확인하거나, 새 방을 만들어 주세요." /></Frame>
  if (inApp && !stay) return <InAppGate name={inApp.name} browser={inApp.browser} steps={inApp.steps} onOpen={inApp.open ? () => inApp.open!(location.href) : null} onStay={() => (stayHere(), setStay(true))} />
  if (!info) return <Frame><Skeleton /></Frame>
  if (!joined) return <JoinConfirm code={code} info={info} onJoin={() => setJoined(true)} />
  return <RoomBody code={code} state={state} send={send} />
}

function Frame({ children, back = true }: { children: ReactNode; back?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      {back && (
        <header className="flex h-14 items-center">
          <Link to="/community" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
            <ChevronLeft className="h-5 w-5" aria-hidden />
            커뮤니티
          </Link>
        </header>
      )}
      {children}
    </main>
  )
}

/** 아래에 붙는 주 단추 자리(도착 화면과 같은 모양) */
function Dock({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-secondary from-70% to-transparent pb-[max(16px,env(safe-area-inset-bottom))] pt-6">{children}</div>
}

function Empty({ icon, title, body, dark = false }: { icon: ReactNode; title: string; body: ReactNode; dark?: boolean }) {
  return (
    <div className="my-auto px-3 py-10 text-center">
      <span className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full text-white ${dark ? 'bg-ink' : 'bg-primary'}`}>{icon}</span>
      <h1 className="text-[20px] font-bold leading-7 text-ink">{title}</h1>
      <p className="mt-1.5 text-[15px] leading-[22px] text-ink-2">{body}</p>
    </div>
  )
}

function InAppGate({ name, browser, steps, onOpen, onStay }: { name: string; browser: string; steps: [string, string]; onOpen: (() => void) | null; onStay: () => void }) {
  return (
    <Frame back={false}>
      <Empty icon={<ExternalLink className="h-[26px] w-[26px]" strokeWidth={1.75} />} title="브라우저에서 열어 주세요" body={<>{name} 안에서 열면 이 기기의 기록과<br />이름이 따로 생겨요.</>} />
      <p className="rounded-xl bg-white px-3.5 py-2.5 text-[14px] leading-[21px] text-ink">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
        {onOpen ? '아래 단추가 안 되면 ' : ''}
        {steps[0].replace(/요$/, '고')} {steps[1]}
      </p>
      <Dock>
        {onOpen && <Cta onClick={onOpen}>{browser}로 열기</Cta>}
        <div className="mt-1 flex justify-center">
          <TextButton onClick={onStay}>그냥 여기서 할게요</TextButton>
        </div>
      </Dock>
    </Frame>
  )
}

const RULE_TEXT = (r: Rules) => `${r.source === 'random' ? `랜덤${r.difficulty ? ` ${{ easy: '쉬움', normal: '보통', hard: '어려움' }[r.difficulty]}` : ''} 문제` : r.source === 'mine' ? '방장이 낸 문제' : r.source === 'archive' ? '지난 문제' : '커뮤니티 문제'}, ${r.win === 'first' ? '먼저 도착하면 이겨요' : '적게 이동하면 이겨요'}`

/** 링크로 온 사람이 들어가기 전에 보는 화면: 누구의 방인지, 규칙, 내 이름(Among Us의 참가 확인) */
function JoinConfirm({ code, info, onJoin }: { code: string; info: Awaited<ReturnType<typeof getRoom>>; onJoin: () => void }) {
  const [name, setName] = useState(myName)
  const reroll = () => {
    const salt = rerollSalt()
    setName(myName())
    void renamePlayer(salt).catch(() => {})
  }
  return (
    <Frame>
      <Card lift className="text-center">
        <p className="text-[13px] leading-[18px] text-ink-2">같이 달리기 방</p>
        <p className="text-[34px] font-extrabold leading-10 tracking-[0.16em] text-primary tabular-nums">{code}</p>
        <p className="mt-1.5 text-[15px] leading-[22px] text-ink">{info.host ? `${short(info.host)}님의 방이에요` : '아직 아무도 없는 방이에요'}</p>
        <p className="mt-3 rounded-xl bg-secondary px-3.5 py-2.5 text-left text-[14px] leading-[21px] text-ink">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
          {RULE_TEXT(info.rules)}
          {info.rules.limit > 0 && <span className="block pl-4 text-ink-2">시간 {info.rules.limit}분</span>}
        </p>
      </Card>
      {info.names.length > 0 && (
        <Card className="mt-3">
          <CardTitle side={`${info.players}명, 최대 ${MAX_RACERS}명`}>방에 있는 사람</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {info.names.map((n, i) => (
              <SeatChip key={`${i}-${n}`} name={n} sub={numberOf(n)} />
            ))}
          </div>
          {info.full && <p className="mt-3 text-[13px] leading-5 text-ink-2">자리가 다 찼어요. 들어가면 지켜보다가 다음 판에 자리가 나면 함께 달려요.</p>}
        </Card>
      )}
      <Card className="mt-3 flex items-center gap-3">
        <Ava name={name} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-5 text-ink-2">이 이름으로 들어가요</span>
          <b className="block truncate text-[16px] font-semibold leading-[22px] text-ink">{name}</b>
        </span>
        <button onClick={reroll} className="press flex h-10 flex-none items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[14px] font-semibold text-primary">
          <Dices className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          다시 뽑기
        </button>
      </Card>
      <Dock>
        <Cta onClick={onJoin}>{info.full ? '지켜보기로 들어가기' : '들어가기'}</Cta>
      </Dock>
    </Frame>
  )
}

function SeatChip({ name, sub, me = false, host = false, ok = false, dim = false, kick = false, children }: { name: string; sub: ReactNode; me?: boolean; host?: boolean; ok?: boolean; dim?: boolean; kick?: boolean; children?: ReactNode }) {
  return (
    <div className={`relative flex h-14 min-w-0 items-center gap-2 rounded-[14px] bg-secondary pl-2.5 ${kick ? 'pr-7' : 'pr-2.5'} ${dim ? 'opacity-50' : ''}`}>
      <span className="relative">
        {host && <Crown className="absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 fill-[#f5c542] text-[#d9a521]" strokeWidth={1.5} aria-label="방장" />}
        <Ava name={name} me={me} />
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[14px] font-semibold leading-[19px] text-ink">{name.split(' ').slice(0, -1).join(' ')}</b>
        <span className={`block truncate text-[12px] leading-4 ${ok ? 'font-semibold text-primary' : 'text-ink-2'}`}>{sub}</span>
      </span>
      {children}
    </div>
  )
}

type Send = (m: ClientMessage) => void

function RoomBody({ code, state, send }: { code: string; state: RoomState; send: Send }) {
  const navigate = useNavigate()
  const slot = roomSlot(code)
  const run = useGame(s => runIn(s, slot))
  const { room, seat, start, error } = state
  const me = room?.seats.find(s => s.seat === seat) ?? null
  const myRun = run && start && run.runId === start.runId ? run : null
  useRaceReporter(myRun, state, send)

  const leave = () => {
    send({ t: 'leave' })
    try {
      localStorage.removeItem(`linkle:room:${code}`)
    } catch {
      // 지우지 못해도 자리는 비워진다
    }
    navigate('/community')
  }

  if (error === 'kicked') return <Frame><Notice title="방에서 나왔어요" body="방장이 방에서 내보냈어요." /></Frame>
  if (error === 'replaced' && state.phase === 'closed') return <Frame><Notice title="다른 곳에서 열었어요" body="다른 탭이나 기기에서 이 방에 들어왔어요. 그쪽에서 이어서 해 주세요." /></Frame>
  if (error === 'full' && !room) return <FullRoom onNew={() => navigate('/community')} />
  if (error === 'version') return <Frame><Notice title="앱이 새로 나왔어요" body="새로고침하면 이어서 할 수 있어요." /></Frame>
  if (!room || !me) return <Frame><Connecting network={error === 'network'} /></Frame>

  if (room.status === 'lobby') return <Lobby code={code} state={state} me={me} send={send} onLeave={leave} />
  if (room.status === 'results' && state.ended) return <Results code={code} state={state} me={me} send={send} run={myRun} onLeave={leave} />
  if (!start) return <Frame><Connecting network={false} /></Frame>
  return <Race code={code} state={state} me={me} send={send} run={myRun} />
}

function Connecting({ network }: { network: boolean }) {
  return network ? (
    <Notice title="방에 닿지 못했어요" body="연결을 확인해 주세요. 다시 이어지면 그대로 계속돼요." />
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center py-20 text-ink-2">
      <Spinner className="mb-4 h-10 w-10" />
      방에 들어가는 중
    </div>
  )
}

function FullRoom({ onNew }: { onNew: () => void }) {
  return (
    <Frame>
      <Empty icon={<Users className="h-[26px] w-[26px]" strokeWidth={1.75} />} title="방이 꽉 찼어요" body="달리는 사람과 지켜보는 사람이 모두 찼어요. 새 방을 만들어 주세요." />
      <Dock>
        <Cta onClick={onNew}>새 방 만들기</Cta>
      </Dock>
    </Frame>
  )
}

// ── 대기실 ──

function qrPath(text: string) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 })
  let d = ''
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)))
  return { d, size }
}

function Qr({ text, size }: { text: string; size: number }) {
  const { d, size: n } = useMemo(() => qrPath(text), [text])
  return (
    <span className="block flex-none rounded-[14px] bg-white p-2 shadow-[inset_0_0_0_1px_var(--color-line-blue)]" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" className="h-full w-full" role="img" aria-label="방 QR">
        <path d={d} fill="#444f5b" />
      </svg>
    </span>
  )
}

function Lobby({ code, state, me, send, onLeave }: { code: string; state: RoomState; me: SeatView; send: Send; onLeave: () => void }) {
  const navigate = useNavigate()
  const room = state.room!
  const host = me.host
  const players = room.seats.filter(s => s.role !== 'spectator')
  const spectators = room.seats.filter(s => s.role === 'spectator')
  const ready = players.filter(s => (s.ready || s.host) && s.connected && !(room.rules.source === 'mine' && s.host))
  const link = `${location.origin}/room/${code}`
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const [sheet, setSheet] = useState<null | 'pick' | 'win' | 'limit'>(null)
  const [scan, setScan] = useState(false)
  const needsPuzzle = room.rules.source !== 'random' && !room.picked
  const solo = players.length < 2

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '링클 같이 달리기', text: `링클 같이 달리기 방 ${code}`, url: link })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    setToast((await copyText(link)) ? '초대 링크를 복사했어요.' : '복사하지 못했어요.')
  }
  const rule = (r: Partial<Rules>) => send({ t: 'rules', rules: r })

  return (
    <Frame back={false}>
      <header className="flex h-14 items-center">
        <button onClick={onLeave} className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          나가기
        </button>
      </header>

      {solo ? (
        <Card className="text-center">
          <div className="mx-auto w-fit">
            <Qr text={link} size={184} />
          </div>
          <button onClick={async () => setToast((await copyText(link)) ? '초대 링크를 복사했어요.' : '복사하지 못했어요.')} className="press mt-4 text-[34px] font-extrabold leading-10 tracking-[0.16em] text-primary tabular-nums">
            {code}
          </button>
          <p className="text-[14px] leading-5 text-ink-2">친구가 이 QR을 찍거나 코드를 넣으면 들어와요</p>
          <div className="mt-4 flex justify-center gap-1.5">
            <Pill onClick={share} icon={<Share2 />}>링크 보내기</Pill>
            <Pill onClick={() => setScan(true)} icon={<ScanLine />}>친구 QR 찍기</Pill>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-[18px] text-ink-2">같이 달리기 방</p>
            <button onClick={async () => setToast((await copyText(link)) ? '초대 링크를 복사했어요.' : '복사하지 못했어요.')} className="press text-[34px] font-extrabold leading-10 tracking-[0.16em] text-primary tabular-nums">
              {code}
            </button>
            <p className="text-[13px] leading-[18px] text-ink-2">누르면 초대 링크가 복사돼요</p>
            <div className="mt-3 flex gap-1.5">
              <Pill onClick={share} icon={<Share2 />}>보내기</Pill>
              <Pill onClick={() => setScan(true)} icon={<ScanLine />}>찍기</Pill>
            </div>
          </div>
          <Qr text={link} size={112} />
        </Card>
      )}

      <Card className="mt-3">
        <CardTitle side={`${players.length}명, 최대 ${MAX_RACERS}명`}>같이 달릴 사람</CardTitle>
        <div className="grid grid-cols-2 gap-2">
          {players.map(s => (
            <SeatChip
              key={s.seat}
              name={s.name}
              me={s.seat === me.seat}
              host={s.host}
              ok={(s.ready || s.host) && s.connected}
              dim={!s.connected}
              // 이 문제를 풀어 본 사람은 모두에게 보인다(막지는 않는다, 16.7). 준비 여부는 글자 색으로 남는다
              sub={s.solved ? '이 문제를 풀어 봤어요' : `${numberOf(s.name)}, ${!s.connected ? '연결 끊김' : s.host ? (room.rules.source === 'mine' ? '방장, 지켜봄' : '방장, 준비') : s.ready ? '준비' : '기다리는 중'}`}
              kick={host && !s.host}
            >
              <Bubble state={state} seat={s.seat} />
              {host && !s.host && (
                <button onClick={() => send({ t: 'kick', seat: s.seat })} aria-label={`${s.name} 내보내기`} className="press absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-[#b3bcc6]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </SeatChip>
          ))}
          {players.length < 2 && <div className="flex h-14 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#b8c9e6] text-[13px] text-ink-2">친구를 기다려요</div>}
        </div>
        {spectators.length > 0 && <p className="mt-3 text-[13px] leading-5 text-ink-2">지켜보는 사람 {spectators.length}명. 다음 판에 자리가 나면 함께 달려요.</p>}
        <Reactions send={send} className="mt-3" />
      </Card>

      <Card className="mt-3 !py-1">
        <SetRow label="문제" value={room.picked && room.rules.source !== 'random' ? pickedText(room.picked) : RULE_TEXT(room.rules).split(',')[0]!} onClick={host ? () => setSheet('pick') : undefined} />
        <SetRow label="승부" value={room.rules.win === 'first' ? '먼저 도착하면 이겨요' : '적게 이동하면 이겨요'} onClick={host ? () => setSheet('win') : undefined} />
        <SetRow label="시간" value={room.rules.limit ? `${room.rules.limit}분` : '제한 없음'} onClick={host ? () => setSheet('limit') : undefined} />
      </Card>
      {room.rules.source === 'community' && room.picked && <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">처음 도전하는 사람은 이 판이 순위표의 첫 도전이 돼요.</p>}

      <Dock>
        {host ? (
          <>
            <Cta disabled={ready.length < 2 || needsPuzzle} onClick={() => send({ t: 'start' })}>
              출발 ({ready.length}명 준비)
            </Cta>
            <p className="mt-1.5 text-center text-[13px] leading-5 text-ink-2">{needsPuzzle ? '먼저 문제를 골라 주세요' : ready.length < 2 ? '2명부터 출발할 수 있어요' : '방장만 출발할 수 있어요'}</p>
          </>
        ) : me.role === 'spectator' ? (
          <p className="pb-2 text-center text-[14px] leading-5 text-ink-2">지켜보는 중이에요. 다음 판에 자리가 나면 함께 달려요.</p>
        ) : (
          <>
            <Cta onClick={() => send({ t: 'ready', ready: !me.ready })} className={me.ready ? '!bg-white !text-primary shadow-[inset_0_0_0_2px_var(--color-primary)]' : ''}>
              {me.ready ? (
                <>
                  <Check className="h-5 w-5" strokeWidth={2} aria-hidden />
                  준비 완료
                </>
              ) : (
                '준비'
              )}
            </Cta>
            <p className="mt-1.5 text-center text-[13px] leading-5 text-ink-2">{me.ready ? '방장이 출발하면 시작해요. 다시 누르면 풀려요' : '준비하면 방장이 출발할 수 있어요'}</p>
          </>
        )}
      </Dock>

      {sheet === 'pick' && <PickSheet rules={room.rules} onPick={r => (rule(r), setSheet(null))} onClose={() => setSheet(null)} />}
      {sheet === 'win' && (
        <ChoiceSheet
          title="어떻게 이길까요"
          value={room.rules.win}
          options={[
            ['first', '먼저 도착하면 이겨요', '한 명이 도착하는 순간 판이 끝나요. 나머지는 얼마나 가까웠는지로 줄 서요'],
            ['fewest', '적게 이동하면 이겨요', '모두 도착하거나 포기할 때까지 달려요'],
          ]}
          onPick={v => (rule({ win: v as Rules['win'] }), setSheet(null))}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'limit' && (
        <ChoiceSheet
          title="시간 제한"
          value={String(room.rules.limit)}
          options={LIMIT_MINUTES.map(m => [String(m), m ? `${m}분` : '제한 없음', m === 10 ? '기본' : ''] as [string, string, string])}
          onPick={v => (rule({ limit: Number(v) }), setSheet(null))}
          onClose={() => setSheet(null)}
        />
      )}
      {scan && <QrScanner own={code} onRoom={c => (setScan(false), navigate(`/room/${c}`))} onClose={() => setScan(false)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </Frame>
  )
}

const pickedText = (p: NonNullable<RoomState['room']>['picked']) =>
  !p ? '' : p.kind === 'daily' ? `지난 문제 #${p.number}` : p.kind === 'random' ? `랜덤 #${p.number}` : `커뮤니티 #${p.number}`

function Pill({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="press flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[14px] font-semibold text-primary [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[1.75]">
      {icon}
      {children}
    </button>
  )
}

function SetRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="w-16 flex-none text-ink-2">{label}</span>
      <b className="min-w-0 flex-1 truncate text-left font-semibold text-ink">{value}</b>
      {onClick && <ChevronRight className="h-[18px] w-[18px] flex-none text-[#b3bcc6]" aria-hidden />}
    </>
  )
  const cls = 'flex h-[52px] w-full items-center gap-3 border-t border-[#eef1f5] text-[15px] first:border-t-0'
  return onClick ? (
    <button onClick={onClick} className={`press ${cls}`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(30_40_60/0.36)]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[88dvh] w-full max-w-[440px] overflow-auto rounded-t-[24px] bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-[#d6dde7]" aria-hidden />
        <h2 className="mb-1 text-[17px] font-bold leading-[25px] text-ink">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ChoiceSheet({ title, value, options, onPick, onClose }: { title: string; value: string; options: [string, string, string][]; onPick: (v: string) => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      {options.map(([v, label, sub]) => (
        <button key={v} onClick={() => onPick(v)} className={`press mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${v === value ? 'bg-white shadow-[inset_0_0_0_2px_var(--color-primary)]' : 'bg-secondary'}`}>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px] font-semibold leading-[22px] text-ink">{label}</b>
            {sub && <span className="block text-[14px] leading-5 text-ink-2">{sub}</span>}
          </span>
          {v === value && <Check className="h-5 w-5 flex-none text-primary" strokeWidth={2} />}
        </button>
      ))}
    </Sheet>
  )
}

type PickStep = 'top' | 'community' | 'archive' | 'mine'

/** 문제 고르기(방장). 기본은 랜덤이고, 고를 것은 난이도뿐이다 */
function PickSheet({ rules, onPick, onClose }: { rules: Rules; onPick: (r: Partial<Rules>) => void; onClose: () => void }) {
  const [step, setStep] = useState<PickStep>('top')
  const [diff, setDiff] = useState<'any' | 'easy' | 'normal' | 'hard'>(rules.difficulty ?? 'any')
  const opt = (icon: ReactNode, title: string, sub: string, on: boolean, click: () => void) => (
    <button onClick={click} className={`press mt-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left ${on ? 'bg-white shadow-[inset_0_0_0_2px_var(--color-primary)]' : 'bg-secondary'}`}>
      <span className={`grid h-11 w-11 flex-none place-items-center rounded-[14px] ${on ? 'bg-primary text-white' : 'bg-white text-primary'} [&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:stroke-[1.75]`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold leading-[22px] text-ink">{title}</b>
        <span className="block text-[14px] leading-5 text-ink-2">{sub}</span>
      </span>
    </button>
  )
  if (step !== 'top') return <PuzzleList kind={step} onBack={() => setStep('top')} onPick={id => onPick({ source: step, puzzleId: id })} onClose={onClose} />
  return (
    <Sheet title="무슨 문제로 달릴까요" onClose={onClose}>
      {opt(<Dices />, '랜덤', '길이 확인된 문제를 룰렛으로 뽑아요', rules.source === 'random', () => onPick({ source: 'random', difficulty: diff === 'any' ? null : diff }))}
      <div className="mt-2">
        <Segmented
          label="난이도"
          value={diff}
          options={[
            ['any', '아무거나'],
            ['easy', '쉬움'],
            ['normal', '보통'],
            ['hard', '어려움'],
          ]}
          onChange={v => {
            setDiff(v)
            onPick({ source: 'random', difficulty: v === 'any' ? null : v })
          }}
        />
      </div>
      {opt(<Users />, '커뮤니티 문제', '처음이면 순위표에도 올라요', rules.source === 'community', () => setStep('community'))}
      {opt(<Repeat />, '지난 문제', '지난 오늘의 문제를 번호로 골라요', rules.source === 'archive', () => setStep('archive'))}
      {opt(<Eye />, '내가 낸 문제', '나는 달리지 않고 지켜봐요', rules.source === 'mine', () => setStep('mine'))}
    </Sheet>
  )
}

function PuzzleList({ kind, onBack, onPick, onClose }: { kind: Exclude<PickStep, 'top'>; onBack: () => void; onPick: (id: number) => void; onClose: () => void }) {
  const { data, error } = useLoad(`pick:${kind}`, async () => {
    if (kind === 'community') return (await getCommunity('new', 0)).items.map(c => ({ id: c.id, title: c.kind === 'official' ? '링클이 낸 문제' : `${c.author}님의 문제`, sub: `#${c.number}, ${c.plays}명 도전`, diff: c.difficulty }))
    if (kind === 'archive') return (await getArchive(null)).items.map(a => ({ id: a.id, title: `#${a.number}`, sub: `${a.date}, ${a.finished}명 도착`, diff: null }))
    return (await getMine()).items.filter((m: MineRow) => m.status !== 'draft').map(m => ({ id: m.id, title: `${m.start_title} → ${m.end_title}`, sub: `#${m.number}, 친구 ${m.plays}명 도전`, diff: null }))
  })
  const title = kind === 'community' ? '커뮤니티 문제' : kind === 'archive' ? '지난 문제' : '내가 낸 문제'
  return (
    <Sheet title={title} onClose={onClose}>
      <button onClick={onBack} className="press -ml-2 mb-1 flex h-9 items-center gap-0.5 rounded-full pl-1 pr-3 text-[14px] font-medium text-ink-2">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        돌아가기
      </button>
      {!data ? (
        error ? <p className="py-6 text-center text-ink-2">목록을 불러오지 못했어요.</p> : <Skeleton />
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-[15px] leading-[22px] text-ink-2">{kind === 'mine' ? '아직 낸 문제가 없어요. 커뮤니티의 "친구에게 내기"에서 만들어요.' : '고를 문제가 없어요.'}</p>
      ) : (
        <ul>
          {data.map(p => (
            <li key={p.id} className="border-t border-[#eef1f5] first:border-t-0">
              <button onClick={() => onPick(p.id)} className="press flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-[22px] text-ink">
                    {p.title}
                    <DifficultyChip value={p.diff} />
                  </b>
                  <span className="block truncate text-[13px] leading-5 text-ink-2">{p.sub}</span>
                </span>
                <ChevronRight className="h-[18px] w-[18px] flex-none text-[#b3bcc6]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

/** 반응 여섯 칸. 1초에 하나까지(방이 거른다) */
function Reactions({ send, className = '' }: { send: Send; className?: string }) {
  const last = useRef(0)
  return (
    <div className={`grid grid-cols-6 gap-1.5 ${className}`} role="group" aria-label="반응 보내기">
      {REACTIONS.map(r => (
        <button
          key={r}
          onClick={() => {
            if (Date.now() - last.current < 1000) return
            last.current = Date.now()
            send({ t: 'react', id: r })
          }}
          className="press grid h-11 place-items-center rounded-[14px] bg-secondary text-[22px]"
          aria-label={`반응 ${r}`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function Bubble({ state, seat, small = false }: { state: RoomState; seat: number; small?: boolean }) {
  const r = state.reacts.find(x => x.seat === seat)
  if (!r) return null
  // 레이스 바에서는 동물 표시 옆 모서리에 뜬다. 칸이 넓어도 누구의 반응인지 보이게
  return (
    <span key={r.key} className={`pointer-events-none absolute ${small ? 'left-[18px] -top-2.5' : '-right-1 -top-3'} z-10 grid animate-[pop_0.25s_ease-out] place-items-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgb(30_50_90/0.25)] ${small ? 'h-[26px] w-[26px] text-[15px]' : 'h-[30px] w-[30px] text-[17px]'}`} aria-label={`반응 ${r.id}`}>
      {r.id}
    </span>
  )
}

// ── 달리기: 기기가 하는 일(이동마다 알리기, 도착, 자리 비움, 끝난 뒤 내 길 보내기) ──

function useRaceReporter(run: Run | null, state: RoomState, send: Send) {
  const target = useRef<{ round: number; lead: string | null } | null>(null)
  const sent = useRef<{ runId: string; moves: number; arrived: boolean; logged: number }>({ runId: '', moves: 0, arrived: false, logged: 0 })
  const start = state.start

  // 출발 문서와 목표 문서의 첫 문단을 미리 받는다. 느린 휴대폰도 출발 순간 손해를 보지 않고, 친구에게 보낼 색을 구할 수 있다
  useEffect(() => {
    if (!start || target.current?.round === start.round) return
    target.current = { round: start.round, lead: null }
    const round = start.round
    void loadPage(start.puzzle.start.title).catch(() => {})
    void getModel().catch(() => {})
    void loadPage(start.puzzle.end.title)
      .then(p => {
        if (target.current?.round === round) target.current.lead = makeLead(p.title, p.leadText)
      })
      .catch(() => {})
  }, [start])

  // 이동할 때마다 방에 알린다. 내 화면에는 내 색을 보여 주지 않는다
  useEffect(() => {
    if (!run || !start) return
    if (sent.current.runId !== run.runId) sent.current = { runId: run.runId, moves: 0, arrived: false, logged: 0 }
    const s = sent.current
    if (run.events.length > s.moves && !run.stopped) {
      const e = run.events.at(-1)!
      s.moves = run.events.length
      if (e.to.id !== run.puzzle.end.id) {
        void levelFor(run, e.to.id, target.current?.lead ?? null).then(level => send({ t: 'move', moves: run.events.length, back: e.type === 'back', level, title: e.to.title, at: Math.max(0, e.at) }))
      }
    }
    if (run.phase === 'finished' && !run.stopped && !s.arrived) {
      s.arrived = true
      send({ t: 'arrive', moves: run.events.length, at: Math.max(0, (run.finishedAt ?? 0) - run.startedAt), pageId: run.puzzle.end.id })
    }
  }, [run, start, send])

  // 판이 끝나면 내 길을 보낸다. 결과 화면의 "길 다시 보기"에 쓴다(저장하지 않는다)
  useEffect(() => {
    const ended = state.ended
    if (!ended || !run || run.room?.round !== ended.round || sent.current.logged === ended.round) return
    sent.current.logged = ended.round
    // 도착하지 못한 판에는 목표 문서의 문단이 없다. 판을 시작할 때 받아 둔 문단으로 색을 구한다
    void Promise.all(run.events.map(e => (e.to.id === run.puzzle.end.id ? Promise.resolve(null) : levelFor(run, e.to.id, target.current?.lead ?? null)))).then(levels => {
      const entries: LogEntry[] = run.events.map((e, i) => ({ title: e.to.title, at: Math.max(0, e.at), level: levels[i] ?? null, back: e.type === 'back' }))
      send({ t: 'log', round: ended.round, entries })
    })
  }, [state.ended, run, send])

  // 다른 탭에 오래 있으면 친구에게 👀로 보인다. 실격은 아니다(5.2)
  useEffect(() => {
    if (!run || run.phase !== 'playing') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onVis = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') timer = setTimeout(() => send({ t: 'away', away: true }), 5000)
      else send({ t: 'away', away: false })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [run, send])
}

// ── 공개 연출과 달리기 ──

function Race({ code, state, me, send, run }: { code: string; state: RoomState; me: SeatView; send: Send; run: Run | null }) {
  const start = state.start!
  const t = useNow(now)
  const [quit, setQuit] = useState(false)
  if (t < start.startsAt) return <Reveal state={state} me={me} send={send} t={t} />
  if (me.role === 'watch') return <Watch state={state} send={send} />
  if (!run) return <Spectate state={state} send={send} />
  if (run.phase === 'playing')
    return (
      <>
        <Game run={run} slot={roomSlot(code)} onQuit={() => setQuit(true)} quitLabel="포기" top={<RaceBar state={state} me={me} send={send} />} />
        {quit && (
          <ChoiceSheet
            title="포기할까요?"
            value=""
            options={[
              ['yes', '포기하기', '결과는 친구들과 함께 봐요'],
              ['no', '계속 달리기', ''],
            ]}
            onPick={v => {
              setQuit(false)
              if (v === 'yes') {
                send({ t: 'giveup' })
                useGame.getState().stop(roomSlot(code), now())
              }
            }}
            onClose={() => setQuit(false)}
          />
        )}
      </>
    )
  // 적은 이동 방식: 먼저 도착했으면 나머지를 기다린다. 포기했어도 여기서 기다린다
  return (
    <Frame back={false}>
      <div className="-mx-4 min-[360px]:-mx-5">
        <RaceBar state={state} me={me} send={send} />
      </div>
      <Empty
        icon={run.stopped ? <Hourglass className="h-[26px] w-[26px]" strokeWidth={1.75} /> : <Trophy className="h-[26px] w-[26px]" strokeWidth={1.75} />}
        title={run.stopped ? '포기했어요' : `도착! ${run.events.length}번 ${formatClock(Math.max(0, (run.finishedAt ?? 0) - run.startedAt))}`}
        body="다른 사람이 끝날 때까지 기다려요. 반응으로 응원해 보세요."
      />
      <Reactions send={send} />
      <TimeLeft endsAt={start.endsAt} t={t} />
    </Frame>
  )
}

function TimeLeft({ endsAt, t }: { endsAt: number | null; t: number }) {
  if (endsAt === null) return null
  return <p className="mt-3 text-center text-[14px] leading-5 text-ink-2">남은 시간 <b className="font-semibold tabular-nums text-ink">{formatClock(Math.max(0, endsAt - t))}</b></p>
}

/** 공개 연출: 출발 릴이 멈추고, 도착 릴이 멈추고, 첫 문장을 보여 준 뒤 3, 2, 1. 모든 기기가 같은 seed로 같은 장면을 본다 */
function Reveal({ state, me, send, t }: { state: RoomState; me: SeatView; send: Send; t: number }) {
  const start = state.start!
  const base = start.startsAt - REVEAL.go
  const endStop = base + REVEAL.end
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [leads, setLeads] = useState<[string | null, string | null]>([null, null])
  const fast = useNow(now, t < endStop)
  useEffect(() => {
    const ctrl = new AbortController()
    void Promise.all([fetchSummary(start.puzzle.start.title, ctrl.signal), fetchSummary(start.puzzle.end.title, ctrl.signal)]).then(([a, b]) => setLeads([a, b]))
    return () => ctrl.abort()
  }, [start.puzzle.start.title, start.puzzle.end.title])
  const left = Math.ceil((start.startsAt - t) / 1000)
  const counting = t >= endStop + 1500 && left <= 3
  const canRespin = me.host && state.room?.rules.source === 'random' && t < start.startsAt - RESPIN_BEFORE_GO_MS

  if (counting)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-5 text-white">
        <p className="text-[120px] font-extrabold leading-none tabular-nums" aria-live="assertive">{left}</p>
        <div className="mt-10 flex w-full max-w-[400px] items-center gap-2">
          <span className="flex h-11 min-w-0 flex-1 items-center justify-center truncate rounded-xl bg-white px-3 text-[15px] font-semibold text-primary">{start.puzzle.start.title}</span>
          <ArrowRight className="h-5 w-5 flex-none text-white/70" strokeWidth={1.75} />
          <span className="flex h-11 min-w-0 flex-1 items-center justify-center truncate rounded-xl bg-white px-3 text-[15px] font-semibold text-primary">{start.puzzle.end.title}</span>
        </div>
        <p className="mt-4 text-center text-[14px] leading-5 text-white/80">
          출발 문서를 미리 받아 두었어요.
          <br />
          0이 되면 모두 같은 순간에 시간이 흘러요
        </p>
      </div>
    )
  const others = state.room?.seats.filter(s => s.role !== 'spectator') ?? []
  return (
    <div className="flex min-h-dvh flex-col bg-primary px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
        <div className="flex justify-between text-[14px] text-white/80">
          <span>{start.round}판째</span>
          <span>{state.room ? RULE_TEXT(state.room.rules).split(',')[0] : ''}</span>
        </div>
        <div className="mt-12 flex flex-col gap-5">
          <Reel key={`s${start.startsAt}`} label="출발" title={start.puzzle.start.title} seed={start.seed} base={base} total={REVEAL.start} distance={34} lead={leads[0]} reduced={reduced} exclude={[start.puzzle.start.title, start.puzzle.end.title]} />
          <Reel key={`e${start.startsAt}`} label="도착" title={start.puzzle.end.title} seed={start.seed ^ 0x9e3779b9} base={base} total={REVEAL.end} distance={50} lead={leads[1]} reduced={reduced} exclude={[start.puzzle.start.title, start.puzzle.end.title]} />
        </div>
        <div className="mt-auto pt-6 text-center">
          {canRespin && fast >= endStop ? (
            <button onClick={() => send({ t: 'respin' })} className="press mx-auto flex h-12 items-center gap-1.5 rounded-full px-4 text-[16px] font-medium text-white">
              <Repeat className="h-[18px] w-[18px]" strokeWidth={1.75} />
              다시 돌리기 (방장, 한 번)
            </button>
          ) : (
            <p className="text-[14px] text-white/80">모두 같은 룰렛을 보고 있어요</p>
          )}
          <div className="mt-2.5 flex justify-center gap-1.5">
            {others.map(s => (
              <span key={s.seat} className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold ${s.seat === me.seat ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>
                {animalOf(s.name)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const ROW = 56
/** 창에 보이는 줄 수. 가운데 줄이 뽑힌 칸이다 */
const ROWS = 3

/**
 * 룰렛 릴 하나(16.3.3). 세로로 도는 띠를 서버 시각에 맞춰 움직인다: 손잡이를 당긴 듯 빨라졌다가 길게 느려지고,
 * 마지막 몇 칸은 한 칸씩 넘어가다 목표 칸을 살짝 지나쳐 딸깍 돌아온다. 위치는 시각 하나로 정해져 모든 기기가 같은 장면을 본다.
 * 띠는 원통처럼 위아래 칸이 눕고 흐려지며, 빠를수록 번진다.
 */
function Reel({ label, title, seed, base, total, distance, lead, reduced, exclude }: { label: string; title: string; seed: number; base: number; total: number; distance: number; lead: string | null; reduced: boolean; exclude: string[] }) {
  const strip = useMemo(() => {
    const items = reelOf(seed, distance + ROWS + 2, exclude)
    items[distance + 1] = title
    return items
  }, [seed, distance, title, exclude])
  const [frame, setFrame] = useState(() => reelAt(now() - base, total, distance))
  const ticked = useRef(Math.floor(frame.p))
  const landed = useRef(frame.done)

  useEffect(() => {
    if (reduced) return
    let raf = 0
    const loop = () => {
      const f = reelAt(now() - base, total, distance)
      setFrame(f)
      // 느려진 뒤에는 칸이 넘어갈 때마다 짧게 떨린다(지원하는 휴대폰만). 멈출 때는 한 번 더
      const cell = Math.floor(f.p + 0.5)
      if (cell !== ticked.current) {
        ticked.current = cell
        if (f.v > 0 && f.v < 9) navigator.vibrate?.(4)
      }
      if (now() - base >= total && !landed.current) {
        landed.current = true
        navigator.vibrate?.(24)
      }
      if (!f.done) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [base, total, distance, reduced])

  const stopped = reduced ? now() - base >= total : now() - base >= total
  const p = reduced ? (stopped ? distance : 0) : frame.p
  const blur = reduced ? 0 : Math.min(3, frame.v / 9)
  const first = Math.max(0, Math.floor(p) - 1)
  const center = p + 1
  return (
    <div>
      <p className="mb-2 ml-1 text-[14px] leading-5 text-white/70">{label}</p>
      <div className="relative overflow-hidden rounded-[20px] bg-white/10 [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_78%,transparent)]" style={{ height: ROW * ROWS }} aria-live="polite" aria-label={stopped ? `${label} ${title}` : `${label} 고르는 중`}>
        {/* 가운데 창. 멈추면 흰 칸이 되고 한 번 톡 튄다 */}
        <span
          key={stopped ? 'on' : 'off'}
          className={`absolute inset-x-3 top-1/2 z-0 h-[56px] -translate-y-1/2 rounded-[14px] transition-colors duration-200 ${stopped ? 'animate-[land_0.32s_ease-out] bg-white' : 'bg-white/15 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.55)]'}`}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0" style={{ filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined }} aria-hidden>
          {(reduced ? [distance, distance + 1, distance + 2] : Array.from({ length: ROWS + 3 }, (_, k) => first + k)).map(k => {
            const text = reduced && !stopped && k === distance + 1 ? '?' : strip[k]
            if (text === undefined) return null
            const d = k - center // 가운데 줄에서 몇 칸 떨어졌는지
            const y = (k - p) * ROW
            const tilt = Math.max(-1, Math.min(1, d / 1.6))
            const hit = stopped && k === distance + 1
            return (
              <span
                key={k}
                className={`absolute inset-x-0 grid place-items-center whitespace-nowrap px-6 font-bold ${hit ? 'text-primary' : 'text-white'}`}
                style={{
                  top: 0,
                  height: ROW,
                  transform: `translateY(${y}px) scaleY(${(1 - 0.38 * Math.abs(tilt)).toFixed(3)})`,
                  opacity: hit ? 1 : 1 - 0.55 * Math.abs(tilt),
                  fontSize: Math.abs(d) < 0.5 ? 26 : 20,
                }}
              >
                {text}
              </span>
            )
          })}
        </div>
      </div>
      <p className={`mt-2.5 min-h-10 px-1 text-[13px] leading-5 text-white/85 transition-opacity duration-300 ${stopped && lead ? 'opacity-100' : 'opacity-0'}`}>{lead ?? ''}</p>
    </div>
  )
}

/** 레이스 바: 자리마다 동물 표시, 이동 수, 마지막 문서의 색. 자리 순서로 고정한다(16.3.4). 내 칸에는 색을 보여 주지 않는다 */
function RaceBar({ state, me, send }: { state: RoomState; me: SeatView; send: Send }) {
  const [open, setOpen] = useState(false)
  const seats = new Map(state.room?.seats.map(s => [s.seat, s]))
  const last = useRef(0)
  return (
    <div className="relative flex h-12 flex-none items-center gap-1 border-b border-line bg-white px-3 short:h-11" aria-label="같이 달리는 사람">
      {state.progress.map(p => {
        const s = seats.get(p.seat)
        if (!s) return null
        const mine = p.seat === me.seat
        return (
          <div key={p.seat} className={`relative flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-xl px-1.5 ${mine ? 'bg-secondary' : ''} ${p.away && !mine ? 'opacity-55' : ''}`} aria-label={`${s.name} ${p.moves}번째`}>
            <Ava name={s.name} me={mine} size={24} />
            <b className={`text-[15px] font-bold tabular-nums ${mine ? 'text-primary' : 'text-ink'}`}>{p.moves}</b>
            <RacerMark p={p} mine={mine} />
            <Bubble state={state} seat={p.seat} small />
          </div>
        )
      })}
      <button onClick={() => setOpen(o => !o)} aria-label="반응 보내기" className={`press grid h-9 w-9 flex-none place-items-center rounded-full text-ink ${open ? 'bg-secondary' : ''}`}>
        <SmilePlus className="h-[22px] w-[22px]" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute right-2 top-[calc(100%+6px)] z-20 grid grid-cols-6 gap-0.5 rounded-[18px] bg-white p-1.5 shadow-[0_12px_32px_-10px_rgb(30_50_90/0.35),0_2px_6px_rgb(30_50_90/0.08)]">
          {REACTIONS.map((r: Reaction) => (
            <button
              key={r}
              onClick={() => {
                if (Date.now() - last.current >= 1000) {
                  last.current = Date.now()
                  send({ t: 'react', id: r })
                }
                setOpen(false)
              }}
              className="press grid h-10 w-10 place-items-center rounded-xl text-[22px]"
              aria-label={`반응 ${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RacerMark({ p, mine }: { p: Progress; mine: boolean }) {
  if (p.state === 'arrived') return <EmojiSq emoji="🏁" size={18} />
  if (p.state === 'gaveup') return <X className="h-4 w-4 text-ink-2" strokeWidth={2.4} aria-label="포기" />
  if (p.away && !mine) return <span className="text-[12px]" aria-label="자리 비움">👀</span>
  if (mine) return null
  if (p.state === 'back') return <EmojiSq emoji="⏪" size={18} />
  return p.moves > 0 ? <LevelSq level={p.level} /> : null
}

/** 출제자 관전: 친구들이 지금 어느 문서에 있는지 이름까지(출제자는 답을 알고 겨루지 않는다, 16.3.5) */
function Watch({ state, send }: { state: RoomState; send: Send }) {
  const start = state.start!
  const t = useNow(now)
  const seats = new Map(state.room?.seats.map(s => [s.seat, s]))
  const { data } = useLoad(`mine-for-watch:${start.puzzle.id}`, () => getMine())
  const path = data?.items.find(m => m.id === start.puzzle.id)?.solution ?? []
  const where = (title: string) => state.progress.filter(p => state.watch[p.seat]?.title === title).map(p => seats.get(p.seat)!)
  return (
    <div className="flex h-dvh flex-col bg-secondary">
      <header className="flex h-14 flex-none items-center gap-2.5 border-b border-line bg-secondary pl-4 pr-2">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink text-white">
          <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="flex-none text-[13px] text-ink-2">지켜보는 중</span>
          <b className="truncate text-[17px] font-semibold text-ink">
            {start.puzzle.start.title} → {start.puzzle.end.title}
          </b>
        </p>
      </header>
      <div className="mx-auto w-full max-w-[440px] flex-1 overflow-auto px-4 py-4 min-[360px]:px-5">
        <Card className="!py-4">
          <CardTitle side={formatClock(Math.max(0, t - start.startsAt))}>지금 어디에</CardTitle>
          {state.progress.map(p => {
            const s = seats.get(p.seat)
            const w = state.watch[p.seat]
            if (!s) return null
            return (
              <div key={p.seat} className="flex h-9 items-center gap-2.5">
                <Ava name={s.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                  <b className="font-semibold">{p.state === 'arrived' ? start.puzzle.end.title : (w?.title ?? start.puzzle.start.title)}</b>
                </span>
                <span className="text-[14px] text-ink-2">{p.state === 'arrived' ? '도착' : `${p.moves}번째`}</span>
                {p.state === 'arrived' ? <EmojiSq emoji="🏁" size={18} /> : p.state === 'back' ? <EmojiSq emoji="⏪" size={18} /> : <LevelSq level={p.level} />}
              </div>
            )
          })}
        </Card>
        {path.length > 0 && (
          <Card className="mt-3 !py-4">
            <CardTitle side={`${path.length}번`}>내가 간 길</CardTitle>
            <ol>
              {[{ id: start.puzzle.start.id, title: start.puzzle.start.title }, ...path].map((s, i) => (
                <li key={`${i}-${s.id}`} className={`flex h-9 items-center gap-3 text-[15px] ${i === 0 || i === path.length ? 'font-semibold text-primary' : 'font-medium text-ink'}`}>
                  <span className="w-5 text-center text-[13px] tabular-nums text-ink-2">{i}</span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <span className="flex gap-1">
                    {where(s.title).map(x => (
                      <Ava key={x.seat} name={x.name} size={24} />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )}
        <p className="mt-2.5 px-1 text-[13px] leading-5 text-ink-2">문서 이름은 출제자인 나에게만 보여요. 친구들은 서로의 이동 수와 색만 봐요.</p>
        <TimeLeft endsAt={start.endsAt} t={t} />
      </div>
      <footer className="flex-none border-t border-line bg-secondary px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[440px]">
          <Reactions send={send} />
        </div>
      </footer>
    </div>
  )
}

/** 정원이 차서 지켜보는 사람: 달리는 사람과 같은 것(이동 수, 색)만 본다 */
function Spectate({ state, send }: { state: RoomState; send: Send }) {
  const t = useNow(now)
  const seats = new Map(state.room?.seats.map(s => [s.seat, s]))
  return (
    <Frame back={false}>
      <header className="flex h-14 items-center gap-2 text-[15px] text-ink-2">
        <Eye className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        지켜보는 중, {formatClock(Math.max(0, t - (state.start?.startsAt ?? t)))}
      </header>
      <Card className="!py-4">
        <CardTitle>달리는 사람</CardTitle>
        {state.progress.map(p => {
          const s = seats.get(p.seat)
          if (!s) return null
          return (
            <div key={p.seat} className="relative flex h-10 items-center gap-2.5">
              <Ava name={s.name} size={24} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{s.name}</span>
              <span className="text-[14px] tabular-nums text-ink-2">{p.state === 'arrived' ? '도착' : `${p.moves}번째`}</span>
              <RacerMark p={p} mine={false} />
            </div>
          )
        })}
      </Card>
      <Reactions send={send} className="mt-3" />
      <TimeLeft endsAt={state.start?.endsAt ?? null} t={t} />
    </Frame>
  )
}

// ── 결과 ──

function Results({ code, state, me, send, run, onLeave }: { code: string; state: RoomState; me: SeatView; send: Send; run: Run | null; onLeave: () => void }) {
  const ended = state.ended!
  const start = state.start
  const [replay, setReplay] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const rows = ended.results
  const win = state.room!.rules.win
  const winner = rows[0]?.ms !== null ? rows[0] : undefined
  const rest = winner ? rows.slice(1) : rows
  const seats = state.room!.seats
  const players = seats.filter(s => s.role !== 'spectator')
  const winnerLog = winner ? state.logs[winner.seat] : undefined
  const arrived = run && run.phase === 'finished' && !run.stopped

  if (replay && start) return <Replay state={state} me={me} onBack={() => setReplay(false)} />

  const title = !winner ? '아무도 도착하지 못했어요' : winner.seat === me.seat ? (win === 'first' ? '내가 먼저 도착!' : '내가 이겼어요!') : `${short(winner.name)}님이 ${win === 'first' ? '먼저 도착!' : '이겼어요!'}`
  const share = async () => {
    const medal = ['🥇', '🥈', '🥉']
    const head = rows
      .slice(0, 3)
      .map((r, i) => `${medal[i]} ${short(r.name)} ${r.ms !== null ? formatClock(r.ms) : `${r.moves}번째`}`)
      .join('  ')
    const lines = rows
      .map(r => {
        const log = state.logs[r.seat]
        if (!log) return null
        const sq = log.map(e => (e.back ? '⏪' : e.title === start?.puzzle.end.title ? '🏁' : e.level === null ? '⬜' : LEVEL_EMOJI[e.level])).join('')
        return `${short(r.name)} ${sq}`
      })
      .filter(Boolean)
    const text = ['Linkle 같이 달리기 🔗', head, ...(lines.length ? ['', ...lines] : []), '', location.host].join('\n')
    setToast((await copyText(text)) ? '결과를 복사했어요. 붙여 넣어 공유해 보세요.' : '복사하지 못했어요.')
  }

  return (
    <Frame back={false}>
      <header className="flex h-14 items-center">
        <button onClick={onLeave} className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          나가기
        </button>
      </header>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-white">
          <Trophy className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold leading-[30px] tracking-[-0.01em] text-ink">{title}</h1>
          {start && (
            <p className="truncate text-[14px] leading-5 text-ink-2">
              {ended.round}판째, {start.puzzle.start.title} → {start.puzzle.end.title}
            </p>
          )}
        </div>
      </div>

      {winner && (
        <Card className="mt-4 !py-4">
          <CardTitle side={ended.reason === 'time' ? '시간 끝' : undefined}>{win === 'first' ? '먼저 도착' : '이긴 사람'}</CardTitle>
          <div className={`-mx-2 flex h-12 items-center gap-3 rounded-xl px-2 ${winner.seat === me.seat ? 'bg-secondary' : ''}`}>
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[#f5c542] text-[13px] font-bold text-white">1</span>
            <Ava name={winner.name} me={winner.seat === me.seat} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{winner.name}</span>
            <span className="flex flex-none gap-2 text-[14px] tabular-nums text-ink">
              <b className="font-semibold text-primary">{formatClock(winner.ms!)}</b>
              {winner.moves}번
            </span>
          </div>
          {winnerLog && start && <p className="mt-1 truncate text-[13px] leading-[18px] text-ink-2">{[start.puzzle.start.title, ...winnerLog.filter(e => !e.back).map(e => e.title)].join(' → ')}</p>}
        </Card>
      )}

      {rest.length > 0 && (
        <Card className="mt-3">
          <CardTitle side={win === 'first' && winner ? '그때 있던 문서' : undefined}>{win === 'first' && winner ? '가장 가까웠던 순' : '순위'}</CardTitle>
          <ol className="grid gap-0.5">
            {rest.map((r, i) => (
              <ResultLine key={r.seat} r={r} rank={(winner ? 2 : 1) + i} me={r.seat === me.seat} firstRule={win === 'first' && !!winner} />
            ))}
          </ol>
        </Card>
      )}

      <Card className="mt-3 !py-4">
        <CardTitle side={`${ended.round}판`}>이 방 전적</CardTitle>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px] text-ink-2">
          {[...players]
            .sort((a, b) => b.wins - a.wins)
            .map(s => (
              <span key={s.seat} className="flex items-center gap-1.5">
                <Ava name={s.name} me={s.seat === me.seat} size={24} />
                {s.wins > 0 ? <b className="font-semibold text-primary">{s.wins}승</b> : '0승'}
              </span>
            ))}
        </div>
      </Card>

      {arrived && start?.puzzle.kind !== 'daily' && (
        <TextButton onClick={async () => setToast(await sendChallenge(run))} className="mx-auto mt-1 !flex w-fit">
          <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />이 문제로 도전장 보내기
        </TextButton>
      )}

      <Dock>
        <Cta onClick={() => send({ t: 'again' })} disabled={me.role === 'spectator' && players.length >= MAX_RACERS}>
          한 판 더
        </Cta>
        <div className="mt-1 flex justify-center">
          <TextButton onClick={() => setReplay(true)}>길 다시 보기</TextButton>
          <TextButton onClick={share}>결과 공유</TextButton>
        </div>
      </Dock>
      {toast && <Toast message={toast} onDone={clearToast} />}
      <span className="hidden">{code}</span>
    </Frame>
  )
}

function ResultLine({ r, rank, me, firstRule }: { r: ResultRow; rank: number; me: boolean; firstRule: boolean }) {
  const sub = r.ms !== null ? `${r.moves}번 만에 도착` : r.state === 'gaveup' ? `포기, ${r.moves}번째` : `${r.title ?? '출발 문서'}, ${r.moves}번째`
  return (
    <li className={`-mx-2 flex h-12 items-center gap-3 rounded-xl px-2 ${me ? 'bg-secondary' : ''}`}>
      <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-bold tabular-nums ${!firstRule && rank <= 3 ? ['bg-[#f5c542] text-white', 'bg-[#b8c3cf] text-white', 'bg-[#d89a62] text-white'][rank - 1] : 'text-ink-2'}`}>{rank}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] leading-5 ${me ? 'font-semibold text-primary' : 'font-medium text-ink'}`}>
          {r.name}
          {me && <span className="ml-1 text-[13px] font-medium text-ink-2">(나)</span>}
        </span>
        <span className="block truncate text-[12px] leading-4 text-ink-2">{sub}</span>
      </span>
      {r.ms !== null ? <b className="flex-none text-[14px] font-semibold tabular-nums text-primary">{formatClock(r.ms)}</b> : <LevelSq level={r.level} />}
    </li>
  )
}

/** 길 다시 보기: 시간 막대 하나로 모두를 같이 움직인다(Strava Flyby) */
function Replay({ state, me, onBack }: { state: RoomState; me: SeatView; onBack: () => void }) {
  const start = state.start!
  const ended = state.ended!
  const seats = new Map(state.room?.seats.map(s => [s.seat, s]))
  const logs = ended.results.map(r => ({ r, log: state.logs[r.seat] ?? [] }))
  const max = Math.max(1000, ...ended.results.map(r => r.ms ?? 0), ...logs.flatMap(x => x.log.map(e => e.at)))
  const [t, setT] = useState(max)
  const counts = new Map<string, Set<number>>()
  for (const { r, log } of logs) for (const e of log) if (!e.back && e.title !== start.puzzle.end.title) (counts.get(e.title) ?? counts.set(e.title, new Set()).get(e.title)!).add(r.seat)
  const together = [...counts.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size).slice(0, 4)
  return (
    <Frame back={false}>
      <header className="flex h-14 items-center">
        <button onClick={onBack} className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          결과
        </button>
      </header>
      <h1 className="text-[22px] font-bold leading-[31px] text-ink">길 다시 보기</h1>
      <Card className="mt-3 !py-4">
        <input type="range" min={0} max={max} step={250} value={t} onChange={e => setT(Number(e.target.value))} aria-label="시간" className="w-full accent-[var(--color-primary)]" />
        <div className="mt-1 flex justify-between text-[12px] leading-4 tabular-nums text-ink-2">
          <span>00:00</span>
          <b className="font-semibold text-primary">{formatClock(t)}</b>
          <span>{formatClock(max)}</span>
        </div>
      </Card>
      <Card className="mt-3 !py-4">
        <CardTitle>{formatClock(t)}에 있던 곳</CardTitle>
        {logs.map(({ r, log }) => {
          const s = seats.get(r.seat)
          const done = log.filter(e => e.at <= t)
          const here = done.at(-1)
          return (
            <div key={r.seat} className="flex h-9 items-center gap-2.5">
              <Ava name={r.name} me={r.seat === me.seat} size={24} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                <b className="font-semibold">{here?.title ?? start.puzzle.start.title}</b> {done.length}번째
              </span>
              <span className="flex flex-none gap-[3px]">
                {done.slice(-6).map((e, i) => (
                  <EmojiSq key={i} emoji={e.back ? '⏪' : e.title === start.puzzle.end.title ? '🏁' : e.level === null ? '⬜' : LEVEL_EMOJI[e.level]!} />
                ))}
              </span>
              {!s && <span className="sr-only">나간 사람</span>}
            </div>
          )
        })}
        {logs.every(x => x.log.length === 0) && <p className="text-[14px] leading-5 text-ink-2">길을 받는 중이에요.</p>}
      </Card>
      {together.length > 0 && (
        <Card className="mt-3 !py-4">
          <CardTitle>함께 지난 문서</CardTitle>
          {together.map(([title, s]) => (
            <div key={title} className="flex h-9 items-center gap-2.5 text-[14px]">
              <b className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</b>
              <span className="text-ink-2">{s.size === logs.length ? `${s.size}명 모두` : [...s].map(x => short(seats.get(x)?.name ?? '')).join(', ')}</span>
            </div>
          ))}
        </Card>
      )}
    </Frame>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { animalOf, formatClock, ghostAt, josa, shareOf, type Ghost, type Run } from '@linkle/core'
import { Flag, Undo2 } from 'lucide-react'
import { makeChallenge, type Challenge, type Step } from '../game/api'
import { now } from '../game/store'
import { kindOfEmoji, Sq } from './cards'
import { copyRich } from './share'

// 친구와 겨루기에서 여러 화면이 함께 쓰는 조각(설계 문서 16장, 시안 docs/design/friend-race).
// 사람은 색으로 나누지 않는다: 색은 유사도에만 쓰고, 사람은 이름의 동물 첫 글자로 나눈다.

/** 동물 표시. 나는 채운 파랑, 다른 사람은 옅은 파랑 */
export function Ava({ name, me = false, size = 32, className = '' }: { name: string; me?: boolean; size?: 24 | 28 | 32 | 40; className?: string }) {
  const text = size <= 24 ? 'text-[12px]' : size === 40 ? 'text-[16px]' : 'text-[14px]'
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center rounded-full font-bold ${text} ${me ? 'bg-primary text-white' : 'bg-secondary text-primary'} ${className}`}
      style={{ width: size, height: size }}
    >
      {animalOf(name)}
    </span>
  )
}

/** 유사도 단계(0~4) → 칸 */
export function LevelSq({ level, size = 18 }: { level: number | null; size?: number }) {
  return <Sq kind={level === null ? 'unknown' : ((level + 1) as 1 | 2 | 3 | 4 | 5)} size={size} />
}

/** 이모지 한 글자 → 칸 */
export const EmojiSq = ({ emoji, size = 14 }: { emoji: string; size?: number }) => <Sq kind={kindOfEmoji(emoji)} size={size} />

/**
 * 도전장의 고스트 줄. 머리 바로 아래 40 높이 한 줄이다(16.2).
 * 같은 경과 시간에 보낸 사람이 몇 번째 이동이었는지와 그 문서의 색. 문서 이름은 없다. 누르면 접힌다.
 */
export function GhostBar({ ghost, startedAt }: { ghost: Ghost; startedAt: number }) {
  const [open, setOpen] = useState(true)
  const t = useNow(now)
  const g = ghostAt(ghost, Math.max(0, t - startedAt))
  const short = ghost.name.split(' ').slice(-2, -1)[0] ?? ghost.name
  return (
    <button
      onClick={() => setOpen(o => !o)}
      aria-label={open ? '친구의 진행 접기' : '친구의 진행 펼치기'}
      className="flex h-10 flex-none items-center gap-2 border-b border-line bg-white px-4 text-left text-[14px] text-ink-2 short:h-9"
    >
      <Ava name={ghost.name} size={24} />
      {open ? (
        g.arrived ? (
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold text-ink">{josa(short, '은', '는')}</b> <b className="font-semibold tabular-nums text-ink">{formatClock(ghost.ms)}</b>에 도착했어요
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold text-ink">{josa(short, '은', '는')}</b> 이 시간에 <b className="font-semibold tabular-nums text-ink">{g.moves === 0 ? '출발 전' : `${g.moves}번째`}</b>
          </span>
        )
      ) : (
        <span className="min-w-0 flex-1 truncate">{short}의 진행 보기</span>
      )}
      {open && (g.arrived ? <Sq kind="goal" /> : g.emoji && <EmojiSq emoji={g.emoji} size={18} />)}
    </button>
  )
}

/** 나와 친구 두 칸. 이긴 쪽에 파란 테두리 */
export function VsCards({ me, them, byMoves }: { me: { ms: number; moves: number }; them: { name: string; ms: number; moves: number }; byMoves: boolean }) {
  const cmp = byMoves ? me.moves - them.moves || me.ms - them.ms : me.ms - them.ms || me.moves - them.moves
  const short = them.name.split(' ').slice(-2, -1)[0] ?? them.name
  const cell = (label: ReactNode, v: { ms: number; moves: number }, win: boolean, mine: boolean) => (
    <div className={`rounded-[14px] bg-white p-3 ${win ? 'shadow-[inset_0_0_0_2px_var(--color-primary)]' : ''}`}>
      <div className="flex items-center gap-1.5 text-[13px] leading-[18px] text-ink-2">
        {label}
        {win && <span className="ml-auto inline-flex h-5 items-center rounded-full bg-secondary px-2 text-[12px] font-semibold text-primary">{mine ? '이겼어요' : '이겼어요'}</span>}
      </div>
      <div className={`mt-1.5 text-[20px] font-bold leading-7 tabular-nums ${mine ? 'text-primary' : 'text-ink'}`}>
        {byMoves ? `${v.moves}번` : formatClock(v.ms)}
        <span className="ml-1 text-[14px] font-semibold text-ink-2">{byMoves ? formatClock(v.ms) : `${v.moves}번`}</span>
      </div>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-2">
      {cell(<><Ava name="나 나" me size={24} />나</>, me, cmp < 0, true)}
      {cell(<><Ava name={them.name} size={24} />{short}</>, them, cmp > 0, false)}
    </div>
  )
}

function StepRow({ s, shared, last }: { s: Step; shared: boolean; last: boolean }) {
  const kind = s.emoji ? kindOfEmoji(s.emoji) : 'start'
  return (
    <li className="flex h-8 min-w-0 items-center gap-2 text-[14px]">
      {kind === 'back' ? (
        <i className="grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] bg-[#c9d1da] text-white">
          <Undo2 className="h-[11px] w-[11px]" strokeWidth={2.4} />
        </i>
      ) : kind === 'goal' ? (
        <i className="grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] bg-ink text-white">
          <Flag className="h-[11px] w-[11px]" strokeWidth={2.4} />
        </i>
      ) : (
        <Sq kind={kind} />
      )}
      <span className={`truncate ${shared ? '-ml-1 rounded-md bg-secondary px-1' : ''} ${last ? 'font-semibold text-primary' : 'text-ink'}`}>{s.title}</span>
    </li>
  )
}

/** 두 길을 갈린 곳에서 끊어 나란히 보여 준다. 함께 지난 문서는 옅은 파랑 */
export function TwoPaths({ mine, theirs }: { mine: Step[]; theirs: Step[] }) {
  let fork = 0
  while (fork < mine.length && fork < theirs.length && mine[fork]!.id === theirs[fork]!.id) fork++
  const shared = new Set(mine.map(s => s.id).filter(id => theirs.some(t => t.id === id)))
  const col = (path: Step[], from: number, to: number) => (
    <ol className="min-w-0">
      {path.slice(from, to).map((s, i) => (
        <StepRow key={`${from + i}-${s.id}`} s={s} shared={shared.has(s.id)} last={from + i === path.length - 1} />
      ))}
    </ol>
  )
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold leading-[25px] text-ink">두 길</h2>
        <span className="text-[14px] text-ink-2">{fork >= Math.min(mine.length, theirs.length) ? '끝까지 같았어요' : `${fork}번째에서 갈렸어요`}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {col(mine, 0, fork)}
        {col(theirs, 0, fork)}
      </div>
      {fork < Math.max(mine.length, theirs.length) && (
        <>
          <div className="my-1 border-t-[1.5px] border-dashed border-[#b8c9e6]" />
          <div className="grid grid-cols-2 gap-3">
            {col(mine, fork, mine.length)}
            {col(theirs, fork, theirs.length)}
          </div>
        </>
      )}
    </div>
  )
}

const MEDAL = ['bg-[#f5c542] text-white', 'bg-[#b8c3cf] text-white', 'bg-[#d89a62] text-white']

/** 같은 링크로 푼 사람끼리의 순위 */
export function ChallengeBoard({ data }: { data: Challenge }) {
  return (
    <ol className="grid gap-0.5">
      {data.board.map((r, i) => (
        <li key={`${i}-${r.name}`} className={`-mx-2 flex h-12 items-center gap-3 rounded-xl px-2 ${r.me ? 'bg-secondary' : ''}`}>
          <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-bold tabular-nums ${MEDAL[i] ?? 'text-ink-2'}`}>{i + 1}</span>
          <span className={`min-w-0 flex-1 truncate text-[15px] leading-5 ${r.me ? 'font-semibold text-primary' : 'font-medium text-ink'}`}>
            {r.name}
            {r.me && <span className="ml-1 text-[13px] font-medium text-ink-2">(나)</span>}
            {r.sender && !r.me && <span className="ml-1 text-[13px] font-medium text-ink-2">보낸 사람</span>}
          </span>
          <span className="flex flex-none gap-2 text-[14px] tabular-nums text-ink">
            {data.byAuthor ? (
              <>
                <b className="font-semibold text-primary">{r.moves}번</b>
                {formatClock(r.ms)}
              </>
            ) : (
              <>
                <b className="font-semibold text-primary">{formatClock(r.ms)}</b>
                {r.moves}번
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** 끝낸 판으로 도전장을 만들어 복사한다. 사용자에게 보여 줄 한 줄을 돌려준다 */
export async function sendChallenge(run: Run): Promise<string> {
  try {
    const { code } = await makeChallenge(run.runId)
    const { text, html, url } = shareOf(run, { origin: window.location.origin, challenge: code })
    // 휴대폰에서는 공유 창을 먼저 연다. 취소하거나 없으면 복사한다
    if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text: text.replace(/\n[^\n]*$/, ''), url })
        return '도전장을 보냈어요.'
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return '보내지 않았어요.'
      }
    }
    return (await copyRich(text, html)) ? '도전장을 복사했어요. 친구에게 붙여 넣어 보세요.' : '복사하지 못했어요. 브라우저의 복사 권한을 확인해 주세요.'
  } catch {
    return '도전장을 만들지 못했어요. 잠시 뒤에 다시 눌러 주세요.'
  }
}

/** 1초마다 다시 그리는 시계 값 */
export function useNow(now: () => number, active = true): number {
  const [t, setT] = useState(now)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setT(now()), 250)
    return () => clearInterval(id)
  }, [now, active])
  return t
}

import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Pencil, Users } from 'lucide-react'
import { formatClock, isRoomCode, normalizeRoomCode, puzzleName } from '@linkle/core'
import { ApiError, createRoom, getCommunity, type CommunitySort, type PuzzleCard } from '../game/api'
import { readInbox } from '../game/inbox'
import { solvedIds, useGame } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, TextButton } from '../ui/cards'
import { Ava } from '../ui/Friends'
import { Badge, DifficultyChip, ListPage, ListRow, Segmented } from '../ui/list'
import { Modal, Spinner, Toast } from '../ui/parts'
import { Notice, Skeleton } from './Yesterday'
import { markCreated } from '../game/room'

const SORTS: [CommunitySort, string][] = [
  ['new', '최신'],
  ['popular', '인기'],
  ['hard', '어려운'],
]

/**
 * 커뮤니티. 맨 위에 친구와 겨루기(같이 달리기, 받은 도전장, 친구에게 내기), 그 아래 링클이 낸 문제와 순위표(설계 문서 12.2, 16장).
 * 출발·도착은 목록에 없다. 미리 보이면 길을 찾아 두고 시작할 수 있어 시간 순위가 의미를 잃는다.
 */
export function Community() {
  const [sort, setSort] = useState<CommunitySort>('new')
  const [pages, setPages] = useState<number[]>([0])
  return (
    <ListPage title="커뮤니티" desc="친구와 겨루거나, 링클이 낸 문제로 순위를 겨뤄요.">
      <Friends />
      <Inbox />
      <Segmented
        label="정렬"
        value={sort}
        options={SORTS}
        onChange={v => {
          setSort(v)
          setPages([0])
        }}
      />
      {pages.map((offset, i) => (
        <CommunityPage key={`${sort}:${offset}`} sort={sort} offset={offset} last={i === pages.length - 1} onMore={next => setPages(p => [...p, next])} />
      ))}
    </ListPage>
  )
}

/** 친구와 달리기 카드: 누르면 바로 방이 생긴다(usagi-volleyball의 같이 하기와 같다) */
function Friends() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [joining, setJoining] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const make = async () => {
    setBusy(true)
    try {
      const { code } = await createRoom()
      markCreated(code)
      navigate(`/room/${code}`)
    } catch (e) {
      setToast(e instanceof ApiError && e.code === 'busy' ? '오늘은 같이 달리기가 붐벼요. 오전 9시에 다시 열려요. 도전장은 그대로 보낼 수 있어요.' : '방을 만들지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setBusy(false)
    }
  }
  return (
    <Card className="mb-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-primary text-white">
          <Users className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0">
          <b className="block text-[16px] font-semibold leading-[22px] text-ink">친구와 달리기</b>
          <span className="block text-[14px] leading-5 text-ink-2">같은 문제로 동시에 출발해요</span>
        </span>
      </div>
      <Cta onClick={make} disabled={busy} className="mt-4">
        {busy ? <Spinner className="h-6 w-6 text-white" /> : '방 만들기'}
      </Cta>
      <div className="-mb-3 mt-1 flex justify-center">
        <TextButton onClick={() => setJoining(true)}>코드로 들어가기</TextButton>
        <TextButton onClick={() => navigate('/community/mine')}>
          <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          친구에게 내기
        </TextButton>
      </div>
      {joining && <JoinByCode onClose={() => setJoining(false)} onJoin={code => navigate(`/room/${code}`)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </Card>
  )
}

function JoinByCode({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => void }) {
  const [value, setValue] = useState('')
  const code = normalizeRoomCode(value)
  return (
    <Modal title="코드로 들어가기" onClose={onClose}>
      <p className="mb-3 text-[15px] leading-[22px] text-ink-2">친구 화면에 보이는 네 글자를 넣어 주세요.</p>
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value.slice(0, 6))}
        onKeyDown={e => e.key === 'Enter' && isRoomCode(code) && onJoin(code)}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="방 코드"
        placeholder="K7PX"
        className="h-14 w-full rounded-[14px] bg-secondary px-4 text-center text-[28px] font-extrabold tracking-[0.2em] text-primary uppercase placeholder:text-[#c5d2ea] focus:outline-2 focus:outline-primary"
      />
      <Cta className="mt-4" disabled={!isRoomCode(code)} onClick={() => onJoin(code)}>
        들어가기
      </Cta>
    </Modal>
  )
}

/** 받은 도전장 중 아직 안 푼 것(16.7: 안 푼 것만 보인다) */
function Inbox() {
  const navigate = useNavigate()
  const others = useGame(s => s.others)
  const solved = useMemo(() => solvedIds({ run: null, others }), [others])
  const items = readInbox().filter(x => !solved.includes(x.puzzleId)).slice(0, 3)
  if (items.length === 0) return null
  return (
    <Card className="mb-3 !py-1">
      <ul>
        {items.map(x => (
          <li key={x.code} className="border-t border-[#eef1f5] first:border-t-0">
            <button onClick={() => navigate(`/c/${x.code}`)} className="press -mx-2 flex min-h-[68px] w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2.5 text-left">
              <Ava name={x.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold leading-[22px] text-ink">{x.name.split(' ').slice(-2, -1)[0]}님의 도전장</span>
                <span className="block truncate text-[14px] leading-5 text-ink-2">
                  {puzzleName({ kind: x.kind as 'community', number: x.number }).replace('Linkle ', '')}, {x.moves}번 {formatClock(x.ms)}
                </span>
              </span>
              <span className="flex-none text-[14px] font-semibold text-primary">도전하기</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function rate(c: PuzzleCard): string {
  return c.plays === 0 ? '아직 도전한 사람이 없어요' : `${c.plays.toLocaleString('ko-KR')}명 중 ${c.clears.toLocaleString('ko-KR')}명 도착`
}

function CommunityPage({ sort, offset, last, onMore }: { sort: CommunitySort; offset: number; last: boolean; onMore: (next: number) => void }) {
  const { data, error, reload } = useLoad(`community:${sort}:${offset}`, () => getCommunity(sort, offset))
  const others = useGame(s => s.others)
  if (!data)
    return error ? (
      <Notice title="목록을 불러오지 못했어요" body="잠시 뒤에 다시 시도해 주세요.">
        <TextButton onClick={reload} className="-ml-4 mt-2">
          다시 불러오기
        </TextButton>
      </Notice>
    ) : (
      <Skeleton />
    )
  if (offset === 0 && data.items.length === 0) return <Notice title="아직 문제가 없어요" body="링클이 낸 문제가 곧 올라와요." />
  return (
    <>
      <Card className={`!py-1 ${offset > 0 ? 'mt-3' : ''}`}>
        <ul>
          {data.items.map(c => {
            const mine = others[String(c.id)]
            const rank = mine?.phase === 'finished' ? mine.result?.rank : undefined
            return (
              <ListRow
                key={c.id}
                to={`/community/${c.id}`}
                lead={<Badge top={`#${c.number}`} />}
                title={
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{c.kind === 'official' ? '링클이 낸 문제' : `${c.author}님의 문제`}</span>
                    <DifficultyChip value={c.difficulty} />
                  </span>
                }
                sub={rate(c)}
                trail={rank ? `${rank}위` : mine?.phase === 'finished' ? '완료' : mine?.phase === 'playing' ? '푸는 중' : undefined}
              />
            )
          })}
        </ul>
      </Card>
      {last && data.next !== null && (
        <TextButton onClick={() => onMore(data.next!)} className="mx-auto mt-2">
          더 보기
        </TextButton>
      )}
    </>
  )
}

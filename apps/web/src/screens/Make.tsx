import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Eye, Plus, Send, Users } from 'lucide-react'
import { createRun, formatClock } from '@linkle/core'
import { ApiError, createRoom, getMine, makePuzzle, publishPuzzle, startPuzzle, type MineRow } from '../game/api'
import { runIn, useGame, useImmersive } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, StatTile, TextButton } from '../ui/cards'
import { sendChallenge } from '../ui/Friends'
import { Badge, ListPage } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { WikiSearch, type Picked } from '../ui/WikiSearch'
import { Arrival } from './Arrival'
import { Game } from './Game'
import { markCreated } from '../game/room'
import { CardTitle, Notice, Skeleton } from './Yesterday'

// 친구에게 내기(설계 문서 16.4). 고르기 → 직접 풀기 → 보내기.
// 처음에는 링크가 있는 사람만 풀 수 있다(신고와 검수가 필요 없다). 친구들이 풀어 본 뒤 커뮤니티에 올릴 수 있다.

/** 출제 화면들은 아래에 주 단추가 붙는다. 아래 탭을 치워 단추를 가리지 않게 한다 */
function useNoTabs() {
  const set = useImmersive(s => s.set)
  useEffect(() => {
    set(true)
    return () => set(false)
  }, [set])
}

const MAKE_ERRORS: Record<string, string> = {
  start_missing: '출발 문서를 찾을 수 없어요.',
  end_missing: '도착 문서를 찾을 수 없어요.',
  start_disambig: '출발 문서가 동음이의 문서예요. 뜻 하나를 골라 주세요.',
  end_disambig: '도착 문서가 동음이의 문서예요. 뜻 하나를 골라 주세요.',
  start_year: '연도 문서는 문제로 쓰지 않아요.',
  end_year: '연도 문서는 문제로 쓰지 않아요.',
  start_date: '날짜 문서는 문제로 쓰지 않아요.',
  end_date: '날짜 문서는 문제로 쓰지 않아요.',
  start_list: '목록 문서는 문제로 쓰지 않아요.',
  end_list: '목록 문서는 문제로 쓰지 않아요.',
  duplicate: '같은 출발과 도착의 문제가 이미 있어요.',
  too_many: '오늘은 문제를 충분히 냈어요. 내일 다시 내 주세요.',
  wiki_unavailable: '위키백과에 닿지 못했어요. 잠시 뒤에 다시 해 주세요.',
}

function Steps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-1.5">
      {['고르기', '직접 풀기', '보내기'].map((t, i) => (
        <span key={t} className={`grid h-8 place-items-center rounded-full text-[13px] font-semibold ${i + 1 === at ? 'bg-primary text-white' : i + 1 < at ? 'bg-white text-primary' : 'bg-[#e6ecf6] text-ink-2'}`}>
          {i + 1} {t}
        </span>
      ))}
    </div>
  )
}

/** /community/new: 출발과 도착 고르기. 고르면 서버가 확인하고 초안을 만든 뒤 바로 직접 풀기로 간다 */
export function MakePage() {
  useNoTabs()
  const navigate = useNavigate()
  const [start, setStart] = useState<Picked | null>(null)
  const [end, setEnd] = useState<Picked | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const same = start && end && start.id === end.id
  const go = async () => {
    if (!start || !end) return
    setBusy(true)
    try {
      const { puzzleId } = await makePuzzle(start, end)
      navigate(`/community/mine/${puzzleId}`)
    } catch (e) {
      setToast(e instanceof ApiError ? (MAKE_ERRORS[e.code] ?? '문제를 만들지 못했어요.') : '문제를 만들지 못했어요.')
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to="/community/mine" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          내 문제함
        </Link>
      </header>
      <h1 className="mb-3 text-[22px] font-bold leading-[31px] text-ink">친구에게 문제 내기</h1>
      <Steps at={1} />
      <div className="flex flex-col gap-4">
        <WikiSearch label="출발" value={start} onChange={setStart} placeholder="출발 문서" />
        <WikiSearch label="도착" value={end} onChange={setEnd} placeholder="도착 문서" />
      </div>
      <p className="mt-4 w-fit rounded-xl bg-white px-3.5 py-2.5 text-[14px] leading-[21px] text-ink">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
        직접 풀어 도착해야 보낼 수 있어요. 내 길이 이 문제의 정답 예시가 돼요.
      </p>
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-secondary from-70% to-transparent pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        <Cta disabled={!start || !end || !!same || busy} onClick={go}>
          {busy ? <Spinner className="h-6 w-6 text-white" /> : '직접 풀어 보기'}
        </Cta>
        {same && <p className="mt-1.5 text-center text-[13px] leading-5 text-ink-2">출발과 도착이 같아요</p>}
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </main>
  )
}

/** /community/mine/:id: 내가 낸 문제 하나. 초안이면 직접 풀고, 풀었으면 도전장·방·올리기 */
export function MinePuzzlePage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const run = useGame(s => runIn(s, id))
  const seen = useGame(s => s.seen)
  useNoTabs()
  const { data, error, reload } = useLoad(`mine:${id}:${run?.outbox ?? ''}`, () => getMine())
  const row = data?.items.find(m => m.id === id) ?? null
  const fresh = run?.phase === 'finished' && !seen.includes(run.runId)

  if (run?.phase === 'playing') return <Game run={run} slot={id} />
  if (run && fresh) return <Arrival run={run} third={{ label: '내 문제', value: '완성' }} closeLabel="내 문제함으로" />
  if (!data) return <ListPage title="내 문제" desc="">{error ? <Notice title="불러오지 못했어요" body="잠시 뒤에 다시 시도해 주세요." /> : <Skeleton />}</ListPage>
  if (!row) return <ListPage title="내 문제" desc=""><Notice title="문제를 찾을 수 없어요" body="이 기기에서 낸 문제만 보여요." /></ListPage>
  return <MineDetail row={row} reload={reload} onRoom={async () => {
    const { code } = await createRoom()
    markCreated(code)
    navigate(`/room/${code}`)
  }} />
}

function MineDetail({ row, reload, onRoom }: { row: MineRow; reload: () => void; onRoom: () => Promise<void> }) {
  const run = useGame(s => runIn(s, row.id))
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const draft = row.status === 'draft'
  const solve = async () => {
    setBusy(true)
    try {
      const s = await startPuzzle(row.id)
      useGame.getState().begin(row.id, createRun({ mode: s.mode, puzzle: s.puzzle, runId: s.runId, startedAt: s.startedAt }), s.serverNow)
    } catch {
      setToast('시작하지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setBusy(false)
    }
  }
  const rate = row.plays ? Math.round((row.clears / row.plays) * 100) : null
  const mySolve = run?.phase === 'finished' && !run.stopped ? run : null
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to="/community/mine" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
          내 문제함
        </Link>
      </header>
      <Steps at={draft ? 2 : 3} />
      <Card lift>
        <p className="text-[15px] font-semibold leading-[22px] text-primary">#{row.number}{draft ? ', 아직 직접 풀지 않았어요' : row.status === 'published' ? ', 커뮤니티에 올라감' : ', 링크가 있는 사람만'}</p>
        <p className="mt-0.5 text-[22px] font-bold leading-[31px] text-ink">
          {row.start_title} → {row.end_title}
        </p>
        {draft ? (
          <>
            <p className="mt-2 text-[15px] leading-[22px] text-ink-2">직접 풀어 도착하면 친구에게 보낼 수 있어요. 시간은 재지만 순위에는 들지 않아요.</p>
            <Cta className="mt-4" onClick={solve} disabled={busy}>
              {busy ? <Spinner className="h-6 w-6 text-white" /> : '직접 풀기'}
            </Cta>
          </>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <StatTile className="bg-secondary" label="도전" value={row.plays} unit="명" />
              <StatTile className="bg-secondary" label="도착" value={rate} unit="%" />
              <StatTile className="bg-secondary" label="내 길" value={row.author_moves} unit="번" />
            </dl>
            {row.shorter > 0 && <p className="mt-2 text-[14px] leading-5 text-ink-2">나보다 짧게 간 친구가 {row.shorter}명 있어요.</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                disabled={!mySolve}
                onClick={async () => mySolve && setToast(await sendChallenge(mySolve))}
                className="press flex h-11 items-center justify-center gap-1.5 rounded-full bg-secondary text-[14px] font-semibold text-primary disabled:opacity-50"
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                도전장 보내기
              </button>
              <button onClick={() => void onRoom().catch(() => setToast('방을 만들지 못했어요.'))} className="press flex h-11 items-center justify-center gap-1.5 rounded-full bg-secondary text-[14px] font-semibold text-primary">
                <Users className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />이 문제로 달리기
              </button>
            </div>
            {!mySolve && <p className="mt-2 text-[13px] leading-5 text-ink-2">도전장은 이 문제를 푼 기기에서 보낼 수 있어요.</p>}
            {row.status === 'unlisted' && (
              <div className="mt-3 rounded-xl bg-secondary px-3.5 py-2.5 text-[14px] leading-[21px] text-ink">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                {row.canPublish ? (
                  <>
                    친구들이 풀어 봤어요. <b className="font-semibold text-primary">커뮤니티에 올릴 수 있어요</b>
                    <TextButton
                      className="-mb-2 -ml-4 mt-1 !flex"
                      onClick={async () => {
                        try {
                          await publishPuzzle(row.id)
                          setToast('커뮤니티에 올렸어요.')
                          reload()
                        } catch {
                          setToast('올리지 못했어요.')
                        }
                      }}
                    >
                      커뮤니티에 올리기
                    </TextButton>
                  </>
                ) : (
                  <>친구 5명 이상이 도전하고 20% 넘게 도착하면 커뮤니티에 올릴 수 있어요.</>
                )}
              </div>
            )}
          </>
        )}
      </Card>
      {mySolve && (
        <Card className="mt-3 !py-4">
          <CardTitle side={`${mySolve.events.length}번 ${formatClock((mySolve.finishedAt ?? 0) - mySolve.startedAt)}`}>내가 간 길</CardTitle>
          <p className="text-[14px] leading-[21px] text-ink">{[row.start_title, ...mySolve.events.filter(e => e.type === 'link').map(e => e.to.title)].join(' → ')}</p>
        </Card>
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </main>
  )
}

/** /community/mine: 내가 낸 문제들. 이 기기에만 남는다(로그인이 없다) */
export function MinePage() {
  useNoTabs()
  const navigate = useNavigate()
  const { data, error, reload } = useLoad('mine', () => getMine())
  return (
    <ListPage title="내 문제함" desc="내가 낸 문제예요. 이 기기에만 남아요.">
      <div className="-mt-2 mb-3">
        <Link to="/community" className="press -ml-2 inline-flex h-9 items-center gap-0.5 rounded-full pl-1 pr-3 text-[14px] font-medium text-ink-2">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          커뮤니티
        </Link>
      </div>
      {!data ? (
        error ? (
          <Notice title="불러오지 못했어요" body="잠시 뒤에 다시 시도해 주세요.">
            <TextButton onClick={reload} className="-ml-4 mt-2">
              다시 불러오기
            </TextButton>
          </Notice>
        ) : (
          <Skeleton />
        )
      ) : data.items.length === 0 ? (
        <Notice title="아직 낸 문제가 없어요" body="두 문서를 골라 직접 풀면, 친구에게 보내거나 같이 달리기에서 낼 수 있어요." />
      ) : (
        <Card className="!py-1">
          <ul>
            {data.items.map(m => (
              <li key={m.id} className="border-t border-[#eef1f5] first:border-t-0">
                <button onClick={() => navigate(`/community/mine/${m.id}`)} className="press -mx-2 flex min-h-[68px] w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2.5 text-left">
                  <Badge top={`#${m.number}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold leading-[22px] text-ink">
                      {m.start_title} → {m.end_title}
                    </span>
                    <span className="block truncate text-[14px] leading-5 text-ink-2">
                      {m.status === 'draft' ? '아직 직접 풀지 않았어요' : `친구 ${m.plays}명 중 ${m.clears}명 도착${m.shorter ? `, 나보다 짧게 ${m.shorter}명` : ''}`}
                    </span>
                  </span>
                  {m.status === 'published' ? <Eye className="h-[18px] w-[18px] flex-none text-primary" aria-label="커뮤니티에 올라감" /> : m.canPublish ? <span className="flex-none text-[13px] font-semibold text-primary">올릴 수 있어요</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-secondary from-70% to-transparent pb-4 pt-6">
        <Cta onClick={() => navigate('/community/new')}>
          <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />새 문제 내기
        </Cta>
      </div>
    </ListPage>
  )
}

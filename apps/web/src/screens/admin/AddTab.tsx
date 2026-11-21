import { useState } from 'react'
import { Check } from 'lucide-react'
import { addDays, createRun, moveCount, RECENT_DAYS, type Page } from '@linkle/core'
import { ADMIN_RUN_PREFIX, ADMIN_SLOT, adminApi, guessDifficulty, solutionOf, type Difficulty, type QueueData } from '../../game/admin'
import { now, runIn, useGame } from '../../game/store'
import { Card, Cta, TextButton } from '../../ui/cards'
import { Segmented } from '../../ui/list'
import { Spinner } from '../../ui/parts'
import { WikiSearch, type Picked } from '../../ui/WikiSearch'
import { messageOf, monthDay, SolutionPath, topic, type Notify } from './kit'

// 문제 넣기 탭. 출발과 도착을 고르고(1), 게임 화면에서 직접 풀어 보고(2), 넣을 곳을 고른다(3).
// 고르는 순간 최근 30일에 쓴 문서인지, 같은 문제가 있는지 알려 준다.

const POOLS: ['daily' | 'official', string][] = [
  ['daily', '오늘의 문제 대기열'],
  ['official', '커뮤니티에 바로'],
]
const DIFFS: [Difficulty, string][] = [
  ['easy', '쉬움'],
  ['normal', '보통'],
  ['hard', '어려움'],
]
const GOOD = ['두 문서 모두 많은 사람이 아는 주제', '최소 3번은 눌러야 닿아요', '4번 안에 가는 길이 있어요', '출발과 도착의 주제가 가깝지 않아요', '날짜, 목록, 사건, 살아 있는 사람이 아니에요']

function Steps({ step }: { step: 1 | 3 }) {
  const items = ['출발과 도착 고르기', '직접 풀어 보기', '넣을 곳 고르기']
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[14px] font-semibold text-ink-2">
      {items.map((t, i) => {
        const n = i + 1
        const done = n < step
        const on = n === step
        return (
          <li key={t} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-5 bg-line max-sm:hidden" aria-hidden />}
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[13px] ${on ? 'bg-primary text-white' : done ? 'bg-secondary text-primary' : 'bg-[#e6ecf6] text-ink-2'}`}>
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
            </span>
            <span className={`${on ? 'text-primary' : ''} ${on ? '' : 'max-sm:hidden'}`}>{t}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** 고른 문서가 최근 30일 안에 오늘의 문제로 나왔는지 */
function recentUse(page: Page, q: QueueData | null): string | null {
  if (!q) return null
  const hit = q.placed.filter(p => p.date >= addDays(q.today, -RECENT_DAYS)).find(p => p.start_id === page.id || p.end_id === page.id)
  if (!hit) return null
  const role = hit.start_id === page.id ? '출발' : '도착'
  return `${topic(page.title)} ${monthDay(hit.date)} 문제의 ${role}이에요. 최근 30일 안에 쓴 문서라 오늘의 문제로는 ${monthDay(addDays(hit.date, RECENT_DAYS + 1))}부터 나갈 수 있어요.`
}

export function AddTab({ queue, notify }: { queue: QueueData | null; notify: Notify }) {
  const practice = useGame(s => runIn(s, ADMIN_SLOT))
  const [start, setStart] = useState<Picked | null>(null)
  const [end, setEnd] = useState<Picked | null>(null)
  if (practice?.phase === 'finished') return <AddResult notify={notify} />
  const same = !!start && !!end && start.id === end.id
  const warnings = [start, end].flatMap(p => (p ? [recentUse(p, queue)] : [])).filter((w): w is string => !!w)
  const dup =
    !!start &&
    !!end &&
    !!queue &&
    [...queue.approved, ...queue.placed].some(x => x.start_id === start.id && x.end_id === end.id)
  const play = () => {
    if (!start || !end || same) return
    const puzzle = { id: ADMIN_SLOT, kind: 'community' as const, number: 0, date: null, start: { id: start.id, title: start.title }, end: { id: end.id, title: end.title } }
    const run = createRun({ mode: 'community', puzzle, runId: `${ADMIN_RUN_PREFIX}${crypto.randomUUID()}`, startedAt: now() })
    useGame.getState().begin(ADMIN_SLOT, run, now())
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="sm:!p-6">
        <Steps step={1} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {([
            ['출발 문서', start, setStart, '예: 불고기'],
            ['도착 문서', end, setEnd, '예: 뉴발란스'],
          ] as const).map(([label, value, set, ph]) => (
            <div key={label}>
              <WikiSearch label={label} value={value} onChange={set} placeholder={ph} />
              {value?.description && <p className="mt-2 px-1 text-[14px] leading-5 text-ink-2">{value.description}</p>}
            </div>
          ))}
        </div>
        {same && <p className="mt-4 rounded-xl bg-[#fdeeed] px-3.5 py-2.5 text-[14px] leading-[21px] text-[#c0392b]">출발과 도착이 같아요</p>}
        {warnings.map(w => (
          <p key={w} className="mt-4 rounded-xl bg-[#fdf3d8] px-3.5 py-2.5 text-[14px] leading-[21px] text-[#7a5400]">
            {w}
          </p>
        ))}
        {start && end && !same && (
          <p className={`mt-3 text-[14px] leading-5 ${dup ? 'font-semibold text-[#c0392b]' : 'text-ink-2'}`}>{dup ? '같은 출발과 도착의 문제가 이미 있어요' : '같은 출발과 도착의 문제는 아직 없어요'}</p>
        )}
        <Cta onClick={play} disabled={!start || !end || same} className="mt-6 sm:mx-auto sm:max-w-[320px]">
          직접 풀어 보기
        </Cta>
        <p className="mt-2 text-center text-[13px] leading-5 text-ink-2">도착한 길이 정답 경로가 되고, 서버가 넣기 전에 그 길을 다시 확인해요.</p>
      </Card>
      <Card>
        <h2 className="text-[17px] font-bold leading-[25px] text-ink">좋은 문제의 조건</h2>
        <ul className="mt-2.5 grid gap-2.5">
          {GOOD.map(g => (
            <li key={g} className="flex gap-2 text-[14px] leading-[21px] text-ink">
              <Check className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden />
              {g}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[13px] leading-5 text-ink-2">자동 출제가 지키는 조건과 같아요.</p>
      </Card>
    </div>
  )
}

function AddResult({ notify }: { notify: Notify }) {
  const run = useGame(s => runIn(s, ADMIN_SLOT))!
  const start = run.puzzle.start
  const hops = solutionOf(start, run.events)
  const [pool, setPool] = useState<'daily' | 'official'>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>(() => guessDifficulty(hops.length))
  const [first, setFirst] = useState(true)
  const [busy, setBusy] = useState(false)
  const drop = () => useGame.getState().drop(ADMIN_SLOT)
  const retry = () => useGame.getState().begin(ADMIN_SLOT, createRun({ mode: 'community', puzzle: run.puzzle, runId: `${ADMIN_RUN_PREFIX}${crypto.randomUUID()}`, startedAt: now() }), now())

  const submit = async () => {
    setBusy(true)
    try {
      const r = await adminApi.add(pool, { start, end: run.puzzle.end, par: hops.length, difficulty, solution: hops }, pool === 'daily' && first)
      if (r.added === 0) notify('출발과 도착이 같은 문제가 이미 있어요')
      else notify(pool === 'daily' ? `대기열에 넣었어요. 지금 ${r.queue}개 있어요` : '커뮤니티에 올렸어요')
      drop()
    } catch (e) {
      notify(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-[720px] sm:!p-6">
      <Steps step={3} />
      <h2 className="mt-5 text-[17px] font-bold leading-[25px] text-ink">이 길로 넣을까요?</h2>
      <div className="mt-3">
        <SolutionPath start={start.title} hops={hops} />
      </div>
      <p className="mt-3 text-[14px] leading-5 text-ink-2">
        정답은 {hops.length}번, 실제로는 {moveCount(run)}번 움직였어요.
        {hops.length < 3 && <b className="ml-1 font-semibold text-[#c0392b]">3번보다 짧으면 너무 쉬워요.</b>}
      </p>
      <div className="mt-5 grid gap-x-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-ink-2">어디에 넣을까요</span>
          <Segmented label="넣을 곳" value={pool} options={POOLS} onChange={setPool} />
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-ink-2">난이도</span>
          <Segmented label="난이도" value={difficulty} options={DIFFS} onChange={setDifficulty} />
        </div>
      </div>
      {pool === 'daily' && (
        <label className="mt-1 flex h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink">
          <input type="checkbox" checked={first} onChange={e => setFirst(e.target.checked)} className="h-5 w-5 accent-[#3366CC]" />
          대기열 맨 앞에 두기
        </label>
      )}
      <Cta onClick={submit} disabled={busy} className="mt-4 sm:mx-auto sm:max-w-[320px]">
        {busy ? <Spinner className="h-6 w-6 text-white" /> : '넣기'}
      </Cta>
      <div className="mt-1 flex justify-center gap-2">
        <TextButton onClick={retry}>다시 풀기</TextButton>
        <TextButton onClick={drop} className="text-ink-2!">
          버리기
        </TextButton>
      </div>
    </Card>
  )
}

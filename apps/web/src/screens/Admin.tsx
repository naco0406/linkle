import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpToLine, Eye, EyeOff, LogOut, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { createRun, moveCount, type Page } from '@linkle/core'
import { ApiError } from '../game/api'
import { ADMIN_RUN_PREFIX, ADMIN_SLOT, adminApi, guessDifficulty, solutionOf, type AdminDay, type Difficulty, type Hop, type Overview } from '../game/admin'
import { now, runIn, useGame } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, formatDateKo, StatTile, TextButton } from '../ui/cards'
import { DifficultyChip, Segmented } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { WikiSearch } from '../ui/WikiSearch'
import { Game } from './Game'

// 관리자 화면(/admin). 탭이 없는 넓은 화면이다. 비밀번호로 들어오면 서버가 30일짜리 쿠키를 준다.
//   개요      오늘·내일과 최근 며칠의 문제, 대기열이 얼마나 남았는지
//   대기열    오늘의 문제로 낼 순서. 앞으로 당기거나 뺀다
//   커뮤니티  링클이 낸 문제를 숨기거나 다시 보인다
//   문제 넣기 출발·도착을 골라 직접 풀어 보고, 그 길을 정답으로 넣는다

type Tab = 'overview' | 'queue' | 'community' | 'add'
const TABS: [Tab, string][] = [
  ['overview', '개요'],
  ['queue', '대기열'],
  ['community', '커뮤니티'],
  ['add', '문제 넣기'],
]

const ERRORS: Record<string, string> = {
  network: '서버에 닿지 못했어요',
  wrong_password: '비밀번호가 맞지 않아요',
  no_password: '서버에 관리자 비밀번호가 아직 없어요',
  already_open: '이미 열렸거나 누가 시작한 문제는 바꿀 수 없어요',
  no_change: '이미 반영돼 있어요',
  no_replacement: '대기열에 그날 낼 수 있는 문제가 없어서 그대로 뒀어요(최근 30일에 쓴 문서는 다시 못 써요)',
  unauthorized: '다시 들어와 주세요(로그인이 끝났어요)',
  no_token: 'Worker에 GITHUB_DISPATCH_TOKEN이 없어요',
  recent: '방금 불렀어요. 채우기가 도는 중이라 한 시간 뒤에 다시 누를 수 있어요',
}
const messageOf = (e: unknown) => (e instanceof ApiError ? (ERRORS[e.code] ?? `처리하지 못했어요 (${e.code})`) : '처리하지 못했어요')

export function Admin() {
  const [state, setState] = useState<'checking' | 'out' | 'in'>('checking')
  useEffect(() => {
    document.title = '링클 관리'
    adminApi
      .me()
      .then(() => setState('in'))
      .catch(() => setState('out'))
  }, [])
  if (state === 'checking') return <Center><Spinner className="h-8 w-8" /></Center>
  if (state === 'out') return <Login onIn={() => setState('in')} />
  return <Console onOut={() => setState('out')} />
}

function Center({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center px-5">{children}</main>
}

function Logo() {
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-primary font-['Rhodium_Libre'] text-[20px] leading-none text-white" aria-hidden>
      L
    </span>
  )
}

function Login({ onIn }: { onIn: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.login(password)
      onIn()
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }
  return (
    <Center>
      <form onSubmit={submit} className="w-full max-w-[380px]">
        <Card lift>
          <div className="flex items-center gap-2.5">
            <Logo />
            <h1 className="text-[20px] font-bold leading-7 text-ink">링클 관리</h1>
          </div>
          <label htmlFor="admin-password" className="mb-1.5 mt-5 block text-[13px] font-semibold leading-5 text-ink-2">
            비밀번호
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-white px-4 text-[16px] text-ink outline-none focus:border-primary"
          />
          <p className="mt-2 min-h-5 text-[13px] leading-5 text-[#c0392b]" role="alert">
            {error}
          </p>
          <Cta type="submit" disabled={busy || !password} className="mt-2">
            {busy ? <Spinner className="h-6 w-6 text-white" /> : '들어가기'}
          </Cta>
        </Card>
      </form>
    </Center>
  )
}

function Console({ onOut }: { onOut: () => void }) {
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'overview')
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const practice = useGame(s => runIn(s, ADMIN_SLOT))
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`)
  }, [tab])

  // 직접 풀어 보는 중에는 게임 화면이 화면을 다 쓴다
  if (practice?.phase === 'playing') return <Game run={practice} slot={ADMIN_SLOT} onQuit={() => useGame.getState().drop(ADMIN_SLOT)} />

  const logout = async () => {
    await adminApi.logout().catch(() => {})
    onOut()
  }
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 min-[360px]:px-5 pb-12 pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center gap-2.5">
        <Logo />
        <h1 className="flex-1 text-[19px] font-bold text-ink">링클 관리</h1>
        <TextButton onClick={logout} className="h-10 text-[15px] text-ink-2!">
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          나가기
        </TextButton>
      </header>
      <div className="max-w-[520px]">
        <Segmented label="관리 화면" value={tab} options={TABS} onChange={setTab} />
      </div>
      <div className="mt-2">
        {tab === 'overview' && <OverviewTab notify={setToast} />}
        {tab === 'queue' && <QueueTab notify={setToast} />}
        {tab === 'community' && <CommunityTab notify={setToast} />}
        {tab === 'add' && <AddTab notify={setToast} />}
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </main>
  )
}

type Notify = (message: string) => void

/** 줄마다 붙는 작은 단추. 모두 높이 36으로 같다 */
function RowButton({ children, tone = 'plain', ...rest }: { tone?: 'plain' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const color = tone === 'danger' ? 'bg-[#fdeeed] text-[#c0392b]' : 'bg-secondary text-primary'
  return (
    <button {...rest} className={`press inline-flex h-9 flex-none items-center justify-center gap-1 rounded-full px-3.5 text-[14px] font-semibold disabled:opacity-40 ${color}`}>
      {children}
    </button>
  )
}

/** 되돌리기 어려운 일은 두 번 눌러야 한다. 처음 누르면 문구가 바뀌고 4초 안에 다시 눌러야 한다 */
function ConfirmButton({ children, confirm, onConfirm, disabled, tone = 'danger' }: { children: ReactNode; confirm: string; onConfirm: () => void; disabled?: boolean; tone?: 'plain' | 'danger' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <RowButton tone={tone} disabled={disabled} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirm : children}
    </RowButton>
  )
}

function Section({ title, count, aside, children }: { title: string; count?: number; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-2">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="text-[17px] font-bold leading-[25px] text-ink">
          {title}
          {count !== undefined && <span className="ml-1.5 tabular-nums text-ink-2">{count}</span>}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Pair({ start, end }: { start: string; end: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[16px] font-semibold leading-[22px] text-ink">
      <span className="truncate">{start}</span>
      <ArrowRight className="h-4 w-4 flex-none text-[#b3bcc6]" aria-hidden />
      <span className="truncate">{end}</span>
    </span>
  )
}

function PathLine({ start, solution }: { start: string; solution: string | null }) {
  const hops = hopsOf(solution)
  if (!hops.length) return <span className="text-ink-2">정답 경로 없음</span>
  return <span className="truncate text-ink-2">{[start, ...hops.map(h => h.title)].join(' › ')}</span>
}

const hopsOf = (solution: string | null): Hop[] => {
  try {
    const v = solution ? (JSON.parse(solution) as unknown) : null
    return Array.isArray(v) ? (v as Hop[]) : []
  } catch {
    return []
  }
}

/** 정답 경로를 칩으로. 출발과 도착은 채운 칩, 사이 문서는 옅은 칩. 누른 링크 이름이 문서 이름과 다르면(넘겨주기) 작게 덧붙인다 */
function SolutionPath({ start, hops }: { start: string; hops: Hop[] }) {
  if (!hops.length) return <p className="rounded-xl bg-[#f5f7fa] px-3 py-2.5 text-[14px] text-ink-2">정답 경로가 저장돼 있지 않아요</p>
  const steps = [{ title: start, via: start }, ...hops]
  return (
    <ol className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#f5f7fa] px-3 py-2.5 text-[14px]">
      {steps.map((h, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className={`rounded-lg px-2 py-0.5 font-semibold leading-6 ${i === 0 || i === steps.length - 1 ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
            {h.title}
            {h.via !== h.title && <span className="ml-1 text-[12px] font-medium opacity-70">({h.via})</span>}
          </span>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[#b3bcc6]" aria-hidden />}
        </li>
      ))}
      <li className="ml-1 text-[13px] text-ink-2">{hops.length}번</li>
    </ol>
  )
}

/** 펼친 정답의 id들. 줄마다 따로 펼친다 */
function useReveal() {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setOpen(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return { isOpen: (id: number) => open.has(id), toggle }
}

function RevealButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <RowButton onClick={onClick} aria-expanded={open}>
      {open ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      {open ? '정답 접기' : '정답 보기'}
    </RowButton>
  )
}

function Rows({ children, empty }: { children: ReactNode[]; empty: string }) {
  return (
    <Card className="px-4 py-1">
      {children.length === 0 ? <p className="py-5 text-center text-[15px] text-ink-2">{empty}</p> : <ul>{children}</ul>}
    </Card>
  )
}

function Row({ lead, title, sub, actions, below }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; below?: ReactNode }) {
  // 넓은 화면: [꼬리표 | 제목·설명 | 단추] 한 줄. 좁은 화면: 단추가 제목 아래 오른쪽으로 내려간다
  const cols = lead ? 'grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto]'
  return (
    <li className={`grid min-h-[68px] items-center gap-x-3 gap-y-2 border-t border-[#eef1f5] py-3 first:border-t-0 ${cols}`}>
      {lead && <span className="self-start sm:self-center">{lead}</span>}
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{title}</span>
        {sub && <span className="mt-0.5 flex min-w-0 text-[14px] leading-5">{sub}</span>}
      </span>
      {actions && <span className={`flex items-center justify-end gap-1.5 ${lead ? 'col-start-2 sm:col-start-auto' : ''}`}>{actions}</span>}
      {below && <div className="col-span-full">{below}</div>}
    </li>
  )
}

function DateBadge({ date, today }: { date: string; today: string }) {
  const label = date === today ? '오늘' : date > today ? '예정' : null
  const [, m, d] = date.split('-')
  return (
    <span className={`grid h-11 w-11 place-items-center content-center rounded-[14px] ${label === '오늘' ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>
      <span className="text-[15px] font-bold leading-[18px] tabular-nums">
        {Number(m)}.{Number(d)}
      </span>
      <span className={`text-[11px] font-medium leading-3 ${label === '오늘' ? 'text-white/80' : 'text-ink-2'}`}>{label ?? '지남'}</span>
    </span>
  )
}

const LOW_QUEUE = 7

const kstTime = (at: number) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at)

/** 문제 채우기 상태. Worker가 대기열을 보고 GitHub Actions를 부른다(worker/src/refill.ts) */
/** GitHub가 거절한 까닭. 401은 토큰이 틀리거나 만료, 403·404는 이 저장소의 Actions 쓰기 권한이 없을 때 */
const githubSays = (status: number) =>
  status === 401 ? '토큰이 맞지 않거나 만료됐어요' : status === 403 || status === 404 ? '토큰에 이 저장소의 Actions 쓰기 권한이 없어요' : status === 0 ? 'GitHub에 닿지 못했어요' : 'GitHub가 받지 않았어요'

/** 문제 채우기 상태. Worker가 대기열을 보고 GitHub Actions를 부른다(worker/src/refill.ts). "지금 채우기"로 직접 부를 수도 있다 */
function RefillNote({ refill, total, notify, reload }: { refill: Overview['refill']; total: number; notify: Notify; reload: () => void }) {
  const { last, below, canDispatch } = refill
  const [busy, setBusy] = useState(false)
  const call = async () => {
    setBusy(true)
    try {
      const r = await adminApi.refill()
      notify(r.ok ? '문제 채우기를 불렀어요. 한 시간쯤 뒤에 대기열이 늘어나요' : `${githubSays(r.status)} (${r.status})`)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const text = !canDispatch
    ? `Worker에 GITHUB_DISPATCH_TOKEN이 없어 대기열이 줄어도 자동으로 채우지 못해요.`
    : last && !last.ok
      ? `${kstTime(last.at)}에 문제 채우기를 부르지 못했어요. ${githubSays(last.status)} (${last.status}). 자동으로는 다음 날 다시 불러요.`
      : total < LOW_QUEUE && !(last && Date.now() - last.at < 24 * 3600_000)
        ? `대기열이 ${total}개 남았는데 문제 채우기가 아직 불리지 않았어요.`
        : null
  return (
    // 좁은 화면에서는 버튼이 문구 아래로 내려간다
    <Card className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 !py-3 ${text ? '!bg-[#fdf3d8]' : ''}`}>
      <p className={`min-w-0 flex-1 basis-[240px] text-[14px] leading-[21px] ${text ? 'text-[#7a5400]' : 'text-ink-2'}`}>
        {text ?? (
          <>
            대기열이 {below}개 아래로 줄면 문제 채우기를 자동으로 불러요.
            {last && ` 마지막으로 부른 때는 ${kstTime(last.at)}이에요.`}
          </>
        )}
      </p>
      <ConfirmButton tone="plain" confirm="40개 더 넣을까요?" disabled={busy || !canDispatch} onConfirm={() => void call()}>
        {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        지금 채우기
      </ConfirmButton>
    </Card>
  )
}

function OverviewTab({ notify }: { notify: Notify }) {
  const { data, error, reload } = useLoad('admin:overview', adminApi.overview)
  const [busy, setBusy] = useState<number | null>(null)
  const reveal = useReveal()
  if (error && !data) return <Failed onRetry={reload} />
  if (!data) return <Loading />
  const count = (d: Difficulty) => data.queue.find(q => q.difficulty === d)?.n ?? 0
  const total = data.queue.reduce((n, q) => n + q.n, 0)
  const days = [...data.days].reverse()

  const replace = async (day: AdminDay) => {
    setBusy(day.id)
    try {
      await adminApi.puzzleAction(day.id, 'replace')
      notify(`${formatDateKo(day.date)} 문제를 대기열의 다음 문제로 바꿨어요`)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatTile label="대기열" value={total} unit="개" />
        <StatTile label="쉬움" value={count('easy')} unit="개" />
        <StatTile label="보통" value={count('normal')} unit="개" />
        <StatTile label="어려움" value={count('hard')} unit="개" />
        <StatTile label="커뮤니티" value={data.community?.n ?? 0} unit="개" />
        <StatTile label="기기" value={data.players.toLocaleString('ko-KR')} unit="대" />
      </dl>
      <RefillNote refill={data.refill} total={total} notify={notify} reload={reload} />
      <Section title="날짜별 오늘의 문제" aside={<RowButton onClick={reload}><RefreshCw className="h-4 w-4" aria-hidden />새로고침</RowButton>}>
        <Rows empty="정해진 문제가 없어요">
          {days.map(d => (
            <Row
              key={d.id}
              lead={<DateBadge date={d.date} today={data.today} />}
              title={
                <>
                  <span className="flex-none text-[14px] font-semibold tabular-nums text-primary">#{d.number}</span>
                  <Pair start={d.start_title} end={d.end_title} />
                  <DifficultyChip value={d.difficulty} />
                </>
              }
              sub={
                d.date > data.today ? (
                  <PathLine start={d.start_title} solution={d.solution} />
                ) : (
                  <span className="tabular-nums text-ink-2">
                    {d.plays.toLocaleString('ko-KR')}명 도전, {d.clears.toLocaleString('ko-KR')}명 도착
                    {d.plays > 0 && ` (${Math.round((d.clears / d.plays) * 100)}%)`}
                  </span>
                )
              }
              actions={
                d.date > data.today ? (
                  <ConfirmButton confirm="정말 바꿀까요?" disabled={busy !== null || d.plays > 0} onConfirm={() => void replace(d)}>
                    {busy === d.id ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                    다른 문제로
                  </ConfirmButton>
                ) : (
                  <RevealButton open={reveal.isOpen(d.id)} onClick={() => reveal.toggle(d.id)} />
                )
              }
              below={reveal.isOpen(d.id) && <SolutionPath start={d.start_title} hops={hopsOf(d.solution)} />}
            />
          ))}
        </Rows>
        <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">예정된 문제를 바꾸면 그 문제는 대기열에서 빠지고, 대기열 맨 앞(당겨 둔 문제가 먼저) 문제가 그 날에 들어가요.</p>
      </Section>
    </>
  )
}

function QueueTab({ notify }: { notify: Notify }) {
  const { data, error, reload } = useLoad('admin:queue', adminApi.queue)
  const [busy, setBusy] = useState<number | null>(null)
  if (error && !data) return <Failed onRetry={reload} />
  if (!data) return <Loading />
  const act = async (id: number, action: 'reject' | 'restore' | 'first' | 'unpin', done: string) => {
    setBusy(id)
    try {
      await adminApi.queueAction(id, action)
      notify(done)
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Section title="낼 순서" count={data.approved.length}>
        <Rows empty="대기열이 비었어요">
          {data.approved.map((q, i) => (
            <Row
              key={q.id}
              lead={
                <span className={`grid h-11 w-11 place-items-center rounded-[14px] text-[16px] font-bold tabular-nums ${q.priority > 0 ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>
                  {i + 1}
                </span>
              }
              title={
                <>
                  <Pair start={q.start_title} end={q.end_title} />
                  <DifficultyChip value={q.difficulty} />
                  <span className="flex-none text-[13px] tabular-nums text-ink-2">{q.par}번</span>
                </>
              }
              sub={<PathLine start={q.start_title} solution={q.solution} />}
              actions={
                <>
                  {q.priority > 0 ? (
                    <RowButton disabled={busy !== null} onClick={() => void act(q.id, 'unpin', '당긴 것을 풀었어요')}>
                      당김 풀기
                    </RowButton>
                  ) : (
                    <RowButton disabled={busy !== null} onClick={() => void act(q.id, 'first', '맨 앞으로 당겼어요')}>
                      <ArrowUpToLine className="h-4 w-4" aria-hidden />
                      맨 앞으로
                    </RowButton>
                  )}
                  <RowButton tone="danger" disabled={busy !== null} onClick={() => void act(q.id, 'reject', '대기열에서 뺐어요')}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    빼기
                  </RowButton>
                </>
              }
            />
          ))}
        </Rows>
        <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">당긴 문제는 요일 난이도와 상관없이 먼저 나가요. 나머지는 요일에 맞는 난이도부터 골라요. 월요일과 화요일은 쉬움, 수요일부터 금요일은 보통, 주말은 어려움이에요.</p>
      </Section>
      {data.rejected.length > 0 && (
        <Section title="뺀 문제">
          <Rows empty="">
            {data.rejected.map(q => (
              <Row
                key={q.id}
                title={
                  <>
                    <Pair start={q.start_title} end={q.end_title} />
                    <DifficultyChip value={q.difficulty} />
                  </>
                }
                sub={<span className="truncate text-ink-2">{q.note ?? '이유 없음'}</span>}
                actions={
                  <RowButton disabled={busy !== null} onClick={() => void act(q.id, 'restore', '대기열 끝에 되돌렸어요')}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    되돌리기
                  </RowButton>
                }
              />
            ))}
          </Rows>
        </Section>
      )}
    </>
  )
}

function CommunityTab({ notify }: { notify: Notify }) {
  const { data, error, reload } = useLoad('admin:community', adminApi.community)
  const [busy, setBusy] = useState<number | null>(null)
  const reveal = useReveal()
  if (error && !data) return <Failed onRetry={reload} />
  if (!data) return <Loading />
  const act = async (id: number, action: 'hide' | 'show') => {
    setBusy(id)
    try {
      await adminApi.puzzleAction(id, action)
      notify(action === 'hide' ? '목록에서 숨겼어요' : '다시 보이게 했어요')
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Section title="링클이 낸 문제" count={data.items.length}>
      <Rows empty="아직 문제가 없어요">
        {data.items.map(p => {
          const hidden = p.status !== 'published'
          return (
            <Row
              key={p.id}
              lead={<span className={`grid h-11 w-11 place-items-center rounded-[14px] text-[16px] font-bold tabular-nums ${hidden ? 'bg-[#eef1f5] text-ink-2' : 'bg-secondary text-primary'}`}>{p.number}</span>}
              title={
                <>
                  <span className={hidden ? 'min-w-0 opacity-50' : 'min-w-0'}>
                    <Pair start={p.start_title} end={p.end_title} />
                  </span>
                  <DifficultyChip value={p.difficulty} />
                </>
              }
              sub={
                <span className="tabular-nums text-ink-2">
                  {hidden ? '숨김, ' : ''}
                  {p.plays.toLocaleString('ko-KR')}명 도전, {p.clears.toLocaleString('ko-KR')}명 도착
                </span>
              }
              actions={
                <>
                  <RevealButton open={reveal.isOpen(p.id)} onClick={() => reveal.toggle(p.id)} />
                  {hidden ? (
                    <RowButton disabled={busy !== null} onClick={() => void act(p.id, 'show')}>
                      보이기
                    </RowButton>
                  ) : (
                    <RowButton tone="danger" disabled={busy !== null} onClick={() => void act(p.id, 'hide')}>
                      숨기기
                    </RowButton>
                  )}
                </>
              }
              below={reveal.isOpen(p.id) && <SolutionPath start={p.start_title} hops={hopsOf(p.solution)} />}
            />
          )
        })}
      </Rows>
      <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">숨겨도 순위표와 푼 기록은 남아요. 주소를 아는 사람은 계속 풀 수 있어요.</p>
    </Section>
  )
}

const POOLS: ['daily' | 'official', string][] = [
  ['daily', '오늘의 문제 대기열'],
  ['official', '커뮤니티에 바로'],
]
const DIFFS: [Difficulty, string][] = [
  ['easy', '쉬움'],
  ['normal', '보통'],
  ['hard', '어려움'],
]

function AddTab({ notify }: { notify: Notify }) {
  const practice = useGame(s => runIn(s, ADMIN_SLOT))
  const [start, setStart] = useState<Page | null>(null)
  const [end, setEnd] = useState<Page | null>(null)
  if (practice?.phase === 'finished') return <AddResult notify={notify} />
  const same = !!start && !!end && start.id === end.id
  const play = () => {
    if (!start || !end || same) return
    const puzzle = { id: ADMIN_SLOT, kind: 'community' as const, number: 0, date: null, start, end }
    const run = createRun({ mode: 'community', puzzle, runId: `${ADMIN_RUN_PREFIX}${crypto.randomUUID()}`, startedAt: now() })
    useGame.getState().begin(ADMIN_SLOT, run, now())
  }
  return (
    <Section title="출발과 도착 고르기">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <WikiSearch label="출발 문서" value={start} onChange={setStart} placeholder="예: 불고기" />
          <WikiSearch label="도착 문서" value={end} onChange={setEnd} placeholder="예: 뉴발란스" />
        </div>
        {same && <p className="mt-3 text-[14px] text-[#c0392b]">출발과 도착이 같아요</p>}
        <Cta onClick={play} disabled={!start || !end || same} className="mt-5 sm:mx-auto sm:max-w-[320px]">
          직접 풀어 보기
        </Cta>
        <p className="mt-2 text-center text-[13px] leading-5 text-ink-2">게임과 같은 화면에서 풀어요. 도착한 길이 정답 경로가 되고, 서버가 넣기 전에 그 길을 다시 확인해요.</p>
      </Card>
    </Section>
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
    <Section title="이 길로 넣을까요?">
      <Card>
        <SolutionPath start={start.title} hops={hops} />
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
    </Section>
  )
}

function Loading() {
  return (
    <div className="grid h-48 place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="mt-2 text-center">
      <p className="text-[15px] text-ink">불러오지 못했어요</p>
      <TextButton onClick={onRetry} className="mt-1">
        다시 시도
      </TextButton>
    </Card>
  )
}

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { ADMIN_SLOT, adminApi } from '../game/admin'
import { runIn, useGame } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, Cta, TextButton } from '../ui/cards'
import { Segmented } from '../ui/list'
import { Spinner, Toast } from '../ui/parts'
import { AddTab } from './admin/AddTab'
import { CommunityTab } from './admin/CommunityTab'
import { Failed, Loading, messageOf } from './admin/kit'
import { PlanTab, type PlanFilter } from './admin/PlanTab'
import { TodayTab } from './admin/TodayTab'
import { Game } from './Game'

// 관리자 화면(/admin). 아래 탭이 없는 넓은 화면이다. 비밀번호로 들어오면 서버가 30일짜리 쿠키를 준다.
// 시안: docs/design/admin-redesign. 탭마다 파일이 screens/admin/ 에 있다.
//   오늘      할 일 줄, 오늘과 내일, 최근 14일 도착률, 남은 문제
//   일정      남은 문제를 나갈 날짜에 펼치고, 하나씩 훑어본다(괜찮아요 / 빼기)
//   커뮤니티  링클이 낸 문제를 비교하고 숨기거나 다시 보인다
//   문제 넣기 출발과 도착을 골라 직접 풀어 보고, 그 길을 정답으로 넣는다

type Tab = 'today' | 'plan' | 'community' | 'add'
const TABS: Tab[] = ['today', 'plan', 'community', 'add']
/** 예전 주소(#overview, #queue)도 열리게 */
const tabOf = (hash: string): Tab => (hash === 'overview' ? 'today' : hash === 'queue' ? 'plan' : TABS.includes(hash as Tab) ? (hash as Tab) : 'today')

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
  const [tab, setTab] = useState<Tab>(() => tabOf(location.hash.slice(1)))
  const [filter, setFilter] = useState<PlanFilter>('all')
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const practice = useGame(s => runIn(s, ADMIN_SLOT))
  // 오늘과 일정이 같은 값을 쓰므로 여기서 한 번 받는다
  const overview = useLoad('admin:overview', adminApi.overview)
  const queue = useLoad('admin:queue', adminApi.queue)
  const reloadAll = useCallback(() => {
    overview.reload()
    queue.reload()
  }, [overview.reload, queue.reload])
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`)
  }, [tab])

  // 직접 풀어 보는 중에는 게임 화면이 화면을 다 쓴다
  if (practice?.phase === 'playing') return <Game run={practice} slot={ADMIN_SLOT} onQuit={() => useGame.getState().drop(ADMIN_SLOT)} />

  const logout = async () => {
    await adminApi.logout().catch(() => {})
    onOut()
  }
  const unreviewed = overview.data?.queue.reduce((n, q) => n + (q.unreviewed ?? 0), 0) ?? 0
  const options: [Tab, ReactNode][] = [
    ['today', '오늘'],
    [
      'plan',
      <span key="plan" className="inline-flex items-center gap-1.5">
        일정{unreviewed > 0 && <span className="text-[13px] tabular-nums opacity-80">{unreviewed}</span>}
      </span>,
    ],
    ['community', '커뮤니티'],
    ['add', '문제 넣기'],
  ]
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pb-16 min-[360px]:px-5 sm:px-6">
      {/* 머리와 탭은 위에 붙어 있어 긴 목록을 내려도 다른 탭으로 바로 간다 */}
      <div className="sticky top-0 z-20 -mx-4 bg-secondary px-4 pt-[max(env(safe-area-inset-top),8px)] min-[360px]:-mx-5 min-[360px]:px-5 sm:-mx-6 sm:px-6">
        <header className="flex h-14 items-center gap-2.5">
          <Logo />
          <h1 className="flex-1 text-[19px] font-bold text-ink">링클 관리</h1>
          <TextButton onClick={logout} className="-mr-2 h-10 text-[15px] text-ink-2!">
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            <span className="max-sm:sr-only">나가기</span>
          </TextButton>
        </header>
        <div className="pt-1 sm:max-w-[520px]">
          <Segmented label="관리 화면" value={tab} options={options} onChange={setTab} />
        </div>
      </div>
      <div className="pt-3">
        {tab === 'today' &&
          (overview.data ? (
            <TodayTab overview={overview.data} queue={queue.data} notify={setToast} reload={reloadAll} onReview={() => (setFilter('unreviewed'), setTab('plan'))} />
          ) : overview.error ? (
            <Failed onRetry={overview.reload} />
          ) : (
            <Loading />
          ))}
        {tab === 'plan' &&
          (queue.data ? <PlanTab data={queue.data} filter={filter} onFilter={setFilter} notify={setToast} reload={reloadAll} /> : queue.error ? <Failed onRetry={queue.reload} /> : <Loading />)}
        {tab === 'community' && <CommunityTab notify={setToast} />}
        {tab === 'add' && <AddTab queue={queue.data} notify={setToast} />}
      </div>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </main>
  )
}

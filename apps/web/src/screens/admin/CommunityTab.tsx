import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Ellipsis, ExternalLink, Eye, EyeOff, Route } from 'lucide-react'
import { adminApi, type CommunityItem } from '../../game/admin'
import { useLoad } from '../../game/useLoad'
import { DifficultyChip } from '../../ui/list'
import { Failed, hopsOf, Loading, messageOf, Pair, Pills, SolutionPath, type Notify } from './kit'

// 커뮤니티 탭. 도전 수와 도착률로 비교하는 표. 숨긴 문제는 따로 모으고, 숨기기는 줄 끝 ⋯ 메뉴 안에 둔다.

type Sort = 'number' | 'plays' | 'rate'
const rateOf = (p: CommunityItem) => (p.plays > 0 ? p.clears / p.plays : -1)
// 넓은 화면의 열: 번호, 문제, 난이도, 도전, 도착률, 메뉴
const COLS = 'sm:grid-cols-[44px_minmax(0,1fr)_76px_72px_140px_36px]'

export function CommunityTab({ notify }: { notify: Notify }) {
  const { data, error, reload } = useLoad('admin:community', adminApi.community)
  const [shown, setShown] = useState<'published' | 'hidden'>('published')
  const [sort, setSort] = useState<Sort>('plays')
  const [menu, setMenu] = useState<number | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  if (error && !data) return <Failed onRetry={reload} />
  if (!data) return <Loading />

  const visible = data.items.filter(p => p.status === 'published')
  const hidden = data.items.filter(p => p.status !== 'published')
  const rows = [...(shown === 'published' ? visible : hidden)].sort((a, b) => (sort === 'number' ? b.number - a.number : sort === 'plays' ? b.plays - a.plays : rateOf(b) - rateOf(a)))
  const plays = visible.reduce((n, p) => n + p.plays, 0)
  const clears = visible.reduce((n, p) => n + p.clears, 0)

  const setStatus = async (p: CommunityItem, action: 'hide' | 'show') => {
    setMenu(null)
    setBusy(true)
    try {
      await adminApi.puzzleAction(p.id, action)
      notify(action === 'hide' ? '목록에서 숨겼어요' : '다시 보이게 했어요')
      reload()
    } catch (e) {
      notify(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const toggle = (id: number) =>
    setOpen(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const SortHead = ({ k, children, className = '' }: { k: Sort; children: string; className?: string }) => (
    <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 ${sort === k ? 'text-primary' : ''} ${className}`} aria-pressed={sort === k}>
      {children}
      {sort === k && <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
    </button>
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Pills
          label="커뮤니티 거르기"
          value={shown}
          options={[
            ['published', '보이는 문제', visible.length],
            ['hidden', '숨긴 문제', hidden.length],
          ]}
          onChange={v => (setShown(v), setMenu(null))}
        />
        <span className="text-[13px] leading-5 tabular-nums text-ink-2">
          {visible.length}개 문제에 {plays.toLocaleString('ko-KR')}명 도전, {clears.toLocaleString('ko-KR')}명 도착
        </span>
      </div>
      <div className="rounded-[20px] bg-white px-4 pb-1 sm:px-6">
        <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b border-[#eef1f5] py-3 text-[13px] font-semibold leading-5 text-ink-2 ${COLS}`}>
          <SortHead k="number" className="max-sm:hidden">
            번호
          </SortHead>
          <span className="max-sm:hidden">문제</span>
          <span className="max-sm:hidden">난이도</span>
          <SortHead k="plays" className="justify-self-end max-sm:justify-self-start">
            도전
          </SortHead>
          <SortHead k="rate" className="justify-self-end">
            도착률
          </SortHead>
          <span className="max-sm:hidden" />
        </div>
        {rows.length === 0 && <p className="py-8 text-center text-[15px] text-ink-2">{shown === 'hidden' ? '숨긴 문제가 없어요' : '아직 문제가 없어요'}</p>}
        {rows.map(p => {
          const rate = rateOf(p)
          return (
            <div key={p.id} className="relative border-t border-[#eef1f5] first:border-t-0">
              <div className={`grid min-h-14 grid-cols-[minmax(0,1fr)_36px] items-center gap-x-2 py-2.5 sm:py-0 ${COLS}`}>
                <span className="text-[14px] font-semibold tabular-nums text-primary max-sm:hidden">{p.number}</span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-[14px] font-semibold tabular-nums text-primary sm:hidden">{p.number}</span>
                    <Pair start={p.start_title} end={p.end_title} />
                    <span className="sm:hidden">
                      <DifficultyChip value={p.difficulty} />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-5 tabular-nums text-ink-2 sm:hidden">
                    {p.plays.toLocaleString('ko-KR')}명 도전, {rate < 0 ? '도착률 없음' : `${Math.round(rate * 100)}% 도착`}
                  </span>
                </span>
                <span className="max-sm:hidden">
                  <DifficultyChip value={p.difficulty} />
                </span>
                <span className="justify-self-end text-[15px] tabular-nums text-ink max-sm:hidden">{p.plays.toLocaleString('ko-KR')}</span>
                <span className="flex items-center justify-end gap-2.5 text-[15px] tabular-nums text-ink max-sm:hidden">
                  {rate < 0 ? '–' : `${Math.round(rate * 100)}%`}
                  <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#e6ecf6]">
                    {rate >= 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.round(rate * 100)}%` }} />}
                  </span>
                </span>
                <button
                  onClick={() => setMenu(menu === p.id ? null : p.id)}
                  aria-label="더 보기"
                  aria-expanded={menu === p.id}
                  className={`press grid h-9 w-9 place-items-center rounded-full ${menu === p.id ? 'bg-secondary text-primary' : 'text-ink-2'}`}
                >
                  <Ellipsis className="h-[18px] w-[18px]" />
                </button>
              </div>
              {open.has(p.id) && (
                <div className="pb-3">
                  <SolutionPath start={p.start_title} hops={hopsOf(p.solution)} />
                </div>
              )}
              {menu === p.id && (
                <RowMenu onClose={() => setMenu(null)}>
                  <MenuItem icon={<Route className="h-4 w-4" />} onClick={() => (toggle(p.id), setMenu(null))}>
                    {open.has(p.id) ? '정답 접기' : '정답 보기'}
                  </MenuItem>
                  <MenuItem icon={<ExternalLink className="h-4 w-4" />} href={`/community/${p.id}`} note="링클 화면에서 이 문제를 열어요">
                    문제 열기
                  </MenuItem>
                  {p.status === 'published' ? (
                    <MenuItem icon={<EyeOff className="h-4 w-4" />} danger disabled={busy} onClick={() => void setStatus(p, 'hide')} note="목록에서 빠져요. 순위표와 기록은 남아요">
                      숨기기
                    </MenuItem>
                  ) : (
                    <MenuItem icon={<Eye className="h-4 w-4" />} disabled={busy} onClick={() => void setStatus(p, 'show')} note="커뮤니티 목록에 다시 보여요">
                      다시 보이기
                    </MenuItem>
                  )}
                </RowMenu>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/** 줄 끝 ⋯ 메뉴. 밖을 누르거나 Esc를 누르면 닫힌다 */
function RowMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-label="더 보기"]')) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div ref={ref} role="menu" className="absolute right-0 top-[52px] z-20 w-64 rounded-[14px] bg-white p-1.5 shadow-[0_8px_28px_-8px_rgb(30_50_90/0.28),0_0_0_1px_rgb(30_50_90/0.06)]">
      {children}
    </div>
  )
}

function MenuItem({ icon, children, note, danger, onClick, href, disabled }: { icon: React.ReactNode; children: string; note?: string; danger?: boolean; onClick?: () => void; href?: string; disabled?: boolean }) {
  const body = (
    <>
      <span className="mt-0.5 flex-none">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-5">{children}</span>
        {note && <span className="mt-0.5 block text-[13px] leading-[18px] text-ink-2">{note}</span>}
      </span>
    </>
  )
  const cls = `press flex w-full gap-2.5 rounded-[10px] p-2.5 text-left hover:bg-secondary disabled:opacity-40 ${danger ? 'text-[#c0392b]' : 'text-ink'}`
  return href ? (
    <a role="menuitem" href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <button role="menuitem" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  )
}

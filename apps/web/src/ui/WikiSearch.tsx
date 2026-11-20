import { useEffect, useId, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Page } from '@linkle/core'
import { Spinner } from './parts'

// 위키백과 문서 이름 자동 완성 (설계 문서 13).
// 앞부분이 맞는 문서를 6개까지 보이고, 넘겨주기는 원래 문서로 바꿔 보인다. 동음이의 문서는 고를 수 없다.

const API = 'https://ko.wikipedia.org/w/api.php'
const DEBOUNCE_MS = 300

type Hit = Page & { description: string | null; thumb: string | null; disambig: boolean; from: string | null }

async function suggest(q: string, signal: AbortSignal): Promise<Hit[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'prefixsearch',
    gpssearch: q,
    gpsnamespace: '0',
    gpslimit: '6',
    prop: 'pageprops|pageimages|description',
    ppprop: 'disambiguation',
    piprop: 'thumbnail',
    pithumbsize: '120',
    redirects: '1',
    origin: '*',
  })
  const res = await fetch(`${API}?${params}`, { signal })
  if (!res.ok) throw new Error(String(res.status))
  type Raw = { pageid?: number; title: string; index: number; description?: string; thumbnail?: { source: string }; pageprops?: { disambiguation?: string }; missing?: boolean }
  const data = (await res.json()) as { query?: { pages?: Raw[]; redirects?: { from: string; to: string }[] } }
  const from = new Map((data.query?.redirects ?? []).map(r => [r.to, r.from]))
  return (data.query?.pages ?? [])
    .filter(p => p.pageid && !p.missing)
    .sort((a, b) => a.index - b.index)
    .map(p => ({
      id: p.pageid!,
      title: p.title,
      description: p.description ?? null,
      thumb: p.thumbnail?.source ?? null,
      disambig: p.pageprops?.disambiguation !== undefined,
      from: from.get(p.title) ?? null,
    }))
}

/**
 * 문서 하나를 고르는 입력칸. 고르면 이름이 칸에 남고, 지우기 단추로 다시 고른다.
 * 한글 조합 중에는 Enter가 글자를 확정하는 데 쓰이므로 고르지 않는다.
 */
export function WikiSearch({ label, value, onChange, placeholder }: { label: string; value: Page | null; onChange: (p: Page | null) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const composing = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const list = useId()

  useEffect(() => {
    const q = text.trim()
    if (value || !q) {
      setHits([])
      setBusy(false)
      return
    }
    const ctrl = new AbortController()
    setBusy(true)
    const t = setTimeout(() => {
      suggest(q, ctrl.signal)
        .then(h => {
          setHits(h)
          setActive(Math.max(0, h.findIndex(x => !x.disambig)))
          setFailed(false)
          setBusy(false)
        })
        .catch(e => {
          if ((e as Error).name === 'AbortError') return
          setFailed(true)
          setBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [text, value])

  const pick = (h: Hit) => {
    if (h.disambig) return
    onChange({ id: h.id, title: h.title })
    setText('')
    setOpen(false)
  }

  const move = (d: number) => {
    if (!hits.length) return
    let i = active
    for (let k = 0; k < hits.length; k++) {
      i = (i + d + hits.length) % hits.length
      if (!hits[i]!.disambig) break
    }
    setActive(i)
  }

  if (value) {
    return (
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-ink-2">{label}</span>
        <div className="flex h-12 items-center gap-2 rounded-xl bg-secondary pl-4 pr-1.5">
          <b className="min-w-0 flex-1 truncate text-[16px] font-semibold text-primary">{value.title}</b>
          <button
            onClick={() => {
              onChange(null)
              setTimeout(() => input.current?.focus())
            }}
            aria-label={`${label} 다시 고르기`}
            className="press grid h-9 w-9 flex-none place-items-center rounded-full text-ink-2"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    )
  }

  const showList = open && text.trim() !== '' && (hits.length > 0 || !busy)
  return (
    <div className="relative">
      <label className="mb-1.5 block text-[13px] font-semibold leading-5 text-ink-2" htmlFor={`${list}-input`}>
        {label}
      </label>
      <div className="flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-primary">
        <Search className="h-[18px] w-[18px] flex-none text-ink-2" aria-hidden />
        <input
          ref={input}
          id={`${list}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={list}
          aria-activedescendant={showList && hits[active] ? `${list}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={text}
          placeholder={placeholder ?? '문서 이름'}
          onChange={e => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => (composing.current = false)}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing || composing.current) return
            if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
            else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
            else if (e.key === 'Enter' && hits[active]) (e.preventDefault(), pick(hits[active]!))
            else if (e.key === 'Escape') setOpen(false)
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-[#9aa5b1]"
        />
        {busy && <Spinner className="h-4 w-4 flex-none" />}
      </div>
      {showList && (
        <ul id={list} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_-12px_rgb(30_50_90/0.35)] ring-1 ring-line">
          {hits.length === 0 && <li className="px-4 py-3 text-[14px] text-ink-2">{failed ? '위키백과에 닿지 못했어요' : '맞는 문서가 없어요'}</li>}
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${list}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={h.disambig}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => !h.disambig && setActive(i)}
              onClick={() => pick(h)}
              className={`flex min-h-[56px] items-center gap-3 px-3 py-2 ${h.disambig ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${i === active && !h.disambig ? 'bg-secondary' : ''}`}
            >
              <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg bg-[#eef1f5]">
                {h.thumb ? <img src={h.thumb} alt="" className="h-full w-full object-cover" /> : <span className="text-[15px] font-bold text-ink-2">{h.title[0]}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-[21px] text-ink">{h.title}</span>
                <span className="block truncate text-[13px] leading-[18px] text-ink-2">
                  {h.disambig ? '동음이의 문서라 고를 수 없어요' : h.from ? `${h.from} → 넘겨주기` : (h.description ?? ' ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

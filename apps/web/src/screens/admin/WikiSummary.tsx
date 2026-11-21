import { useEffect, useState } from 'react'

// 위키백과 문서의 첫 문장. 훑어볼 때 제목만으로 판단하지 않게 한다(시안 규칙 5).
// 고른 문제 하나만, 브라우저가 위키백과에서 직접 받는다. 서버를 거치지 않는다.

const cache = new Map<string, Promise<string | null>>()

/** 첫 문장만. "…이다." 같은 끝을 찾고, 없으면 140자에서 자른다 */
export function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const m = /^(.{12,}?[다요]\.)(\s|$)/.exec(t) ?? /^(.{12,}?\.)(\s|$)/.exec(t)
  const s = m?.[1] ?? t
  return s.length > 140 ? `${s.slice(0, 139)}…` : s
}

function summary(title: string): Promise<string | null> {
  let p = cache.get(title)
  if (!p) {
    p = fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      .then(r => (r.ok ? (r.json() as Promise<{ extract?: string; description?: string }>) : null))
      .then(d => (d?.extract ? firstSentence(d.extract) : (d?.description ?? null)))
      .catch(() => {
        cache.delete(title)
        return null
      })
    cache.set(title, p)
  }
  return p
}

export function WikiSummary({ role, title }: { role: string; title: string }) {
  const [text, setText] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setText(undefined)
    void summary(title).then(t => alive && setText(t))
    return () => {
      alive = false
    }
  }, [title])
  return (
    <div className="rounded-[14px] border border-[#eef1f5] px-3.5 py-3">
      <span className="block text-[12px] font-semibold leading-4 text-ink-2">{role}</span>
      <a href={`https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-[22px] text-ink">
        {title}
      </a>
      <p className="mt-0.5 min-h-[19px] text-[13px] leading-[19px] text-ink-2">{text === undefined ? '설명을 받는 중이에요' : (text ?? '설명을 받지 못했어요')}</p>
    </div>
  )
}

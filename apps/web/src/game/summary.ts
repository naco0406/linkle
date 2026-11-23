// 위키백과 요약의 첫 문장. 공개 연출에서 처음 듣는 문서도 무엇인지 알게 한다(16.3.3). 브라우저가 직접 부르고 서버를 거치지 않는다.

const cache = new Map<string, string>()

export async function fetchSummary(title: string, signal?: AbortSignal): Promise<string | null> {
  const hit = cache.get(title)
  if (hit !== undefined) return hit
  try {
    const res = await fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { extract?: string; description?: string }
    const text = firstSentence(data.extract ?? '') || data.description || ''
    cache.set(title, text)
    return text || null
  } catch {
    return null
  }
}

/** "…이다." 또는 "…다." 로 끝나는 첫 문장. 너무 길면 자른다 */
export function firstSentence(text: string): string {
  const t = text.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const m = /^(.+?다\.)(\s|$)/.exec(t)
  const s = (m ? m[1]! : t).trim()
  return s.length > 90 ? `${s.slice(0, 88)}…` : s
}

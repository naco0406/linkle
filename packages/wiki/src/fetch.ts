import { cleanPage, WIKI_ORIGIN, type CleanPage } from './clean.ts'
import type { Policy } from './policy.ts'

export type WikiErrorKind = 'missing' | 'rate_limited' | 'http' | 'parse'

export class WikiError extends Error {
  constructor(
    readonly kind: WikiErrorKind,
    readonly status?: number,
    /** 429일 때 서버가 알려 준 대기 시간(초) */
    readonly retryAfter?: number,
  ) {
    super(`wiki: ${kind}${status ? ` (${status})` : ''}`)
  }
}

export function pageHtmlUrl(title: string): string {
  return `${WIKI_ORIGIN}/w/rest.php/v1/page/${encodeURIComponent(title.replaceAll(' ', '_'))}/html`
}

export type FetchPageOptions = {
  signal?: AbortSignal
  /** HTML 문자열을 Document로 바꾸는 함수. 브라우저는 DOMParser, Node는 같은 DOM API를 주는 파서 */
  parse: (html: string) => Document
  policy?: Policy
  fetch?: typeof fetch
  headers?: Record<string, string>
}

/**
 * 문서를 받아 정리한다. 넘겨주기 제목이면 서버가 307로 최종 문서를 알려 주고 fetch가 따라간다.
 * 돌려주는 id와 title은 최종 문서의 것이다.
 */
export async function fetchPage(title: string, opts: FetchPageOptions): Promise<CleanPage> {
  const res = await (opts.fetch ?? fetch)(pageHtmlUrl(title), { signal: opts.signal, headers: opts.headers, redirect: 'follow' })
  if (res.status === 404) throw new WikiError('missing', 404)
  if (res.status === 429) throw new WikiError('rate_limited', 429, Number(res.headers.get('retry-after')) || undefined)
  if (!res.ok) throw new WikiError('http', res.status)
  const html = await res.text()
  try {
    return cleanPage(opts.parse(html), opts.policy)
  } catch {
    throw new WikiError('parse')
  }
}

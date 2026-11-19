import { fetchPage, WikiError, type CleanPage } from '@linkle/wiki'

const parser = new DOMParser()
const parse = (html: string) => parser.parseFromString(html, 'text/html')

// 방문한 문서는 메모리에 둔다. 뒤로가기는 다시 요청하지 않는다
const cache = new Map<string, CleanPage>()

export async function loadPage(title: string, signal?: AbortSignal): Promise<CleanPage> {
  const hit = cache.get(title)
  if (hit) return hit
  const page = await fetchPage(title, { parse, signal })
  cache.set(title, page)
  cache.set(page.title, page)
  return page
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function errorMessage(e: unknown): string {
  if (e instanceof WikiError) {
    if (e.kind === 'rate_limited') return `요청이 너무 많습니다. ${e.retryAfter ? `${e.retryAfter}초 뒤에 ` : '잠시 뒤에 '}다시 시도해 주세요.`
    if (e.kind === 'missing') return '없는 문서입니다. 다른 링크를 눌러 주세요.'
  }
  return '문서를 불러오지 못했습니다. 다시 시도해 주세요.'
}

import { parseHTML } from 'linkedom'
import { fetchPage, WikiError, type CleanPage } from '@linkle/wiki'

/**
 * 위키백과 요청을 한 줄로 세운다. 동시에 하나씩, 요청 사이에 간격을 둔다.
 * Wikimedia는 연락처 없는 요청을 분당 10회 안팎으로 제한한다(설계 문서 4.1).
 * 연락처가 담긴 User-Agent를 WIKI_USER_AGENT로 주면 간격을 줄여도 된다(WIKI_INTERVAL_MS).
 */
export class Wiki {
  private last = 0
  private readonly pages = new Map<string, CleanPage | null>()
  readonly userAgent: string
  readonly interval: number
  requests = 0

  constructor(userAgent = process.env.WIKI_USER_AGENT || 'Linkle-puzzle-gen/0.1', interval = Number(process.env.WIKI_INTERVAL_MS || 6500)) {
    this.userAgent = userAgent
    this.interval = interval
  }

  private async turn(): Promise<void> {
    const wait = this.last + this.interval - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    this.last = Date.now()
    this.requests++
  }

  /** 요청 제한(429)을 만나면 알려 준 시간만큼 쉬었다가 세 번까지 다시 한다 */
  private async retry<T>(task: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.turn()
      try {
        return await task()
      } catch (e) {
        const limited = e instanceof WikiError ? e.kind === 'rate_limited' : e instanceof RateLimited
        if (!limited || attempt >= 3) throw e
        const sec = (e as { retryAfter?: number }).retryAfter ?? 30
        console.warn(`  요청 제한: ${sec}초 쉼`)
        await new Promise(r => setTimeout(r, sec * 1000))
      }
    }
  }

  /** 게임과 같은 규칙으로 정리한 문서. 없는 문서는 null */
  async page(title: string): Promise<CleanPage | null> {
    if (this.pages.has(title)) return this.pages.get(title)!
    const page = await this.retry(() =>
      fetchPage(title, { parse: html => parseHTML(html).document as unknown as Document, headers: { 'user-agent': this.userAgent, 'api-user-agent': this.userAgent } }),
    ).catch(e => {
      if (e instanceof WikiError && e.kind === 'missing') return null
      throw e
    })
    this.pages.set(title, page)
    return page
  }

  /** Wikimedia REST API(조회수 등). 위키백과 API와 같은 줄에 선다 */
  async rest(url: string): Promise<unknown> {
    return this.retry(async () => {
      const res = await fetch(url, { headers: { 'user-agent': this.userAgent, 'api-user-agent': this.userAgent } })
      if (res.status === 429) throw new RateLimited(Number(res.headers.get('retry-after')) || 30)
      if (!res.ok) throw new Error(`wikimedia rest ${res.status}`)
      return res.json()
    })
  }

  async api(params: Record<string, string>): Promise<unknown> {
    return this.retry(async () => {
      const res = await fetch(`https://ko.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, {
        headers: { 'user-agent': this.userAgent, 'api-user-agent': this.userAgent },
      })
      if (res.status === 429) throw new RateLimited(Number(res.headers.get('retry-after')) || 30)
      if (!res.ok) throw new Error(`wiki api ${res.status}`)
      return res.json()
    })
  }
}

class RateLimited extends Error {
  readonly retryAfter: number
  constructor(retryAfter: number) {
    super('rate limited')
    this.retryAfter = retryAfter
  }
}

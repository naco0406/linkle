import { kstDate } from '@linkle/core'

interface Env {
  ASSETS: Fetcher
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      const now = Date.now()
      return json({ ok: true, serverNow: now, date: kstDate(now) })
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, { status: 404 })
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

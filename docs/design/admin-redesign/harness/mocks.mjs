import { community, overview, queueData } from './world.mjs'
export async function handle({ url, method }) {
  const p = url.pathname
  if (p === '/api/admin/me') return { json: { ok: true } }
  if (p === '/api/today') return { json: { date: '2026-12-03', number: 14, resetsAt: Date.now() + 3600_000, serverNow: Date.now(), finishedCount: 61 } }
  if (method !== 'GET') return { json: { ok: true } }
  if (p === '/api/admin/overview') return { json: overview() }
  if (p === '/api/admin/queue') return { json: queueData() }
  if (p === '/api/admin/community') return { json: { items: community } }
}

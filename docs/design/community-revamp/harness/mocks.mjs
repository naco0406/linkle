import { archive, board, community, info, mine, TODAY } from './world.mjs'
export async function handle({ url, method }) {
  const p = url.pathname
  if (p === '/api/today') return { json: { date: TODAY, number: 14, resetsAt: Date.now() + 3 * 3600_000, serverNow: Date.now(), finishedCount: 61 } }
  if (method !== 'GET') return { json: { ok: true } }
  if (p === '/api/community') return { json: { items: community, next: 8 } }
  if (p === '/api/archive') return { json: { items: archive, next: 6 } }
  if (p === '/api/mine') return { json: { items: mine } }
  if (p === '/api/puzzles/130') return { json: info }
  if (p === '/api/puzzles/130/board') return { json: board }
}

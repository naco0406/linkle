import { board, boardWithMe, community, info, TODAY } from './world.mjs'
export async function handle({ url, method, shot }) {
  const p = url.pathname
  if (p === '/api/today') return { json: { date: TODAY, number: 14, resetsAt: Date.now() + 3 * 3600_000, serverNow: Date.now(), finishedCount: 61 } }
  if (method !== 'GET') return { json: { ok: true } }
  if (p === '/api/community') return { json: { items: community, next: 8 } }
  if (p === '/api/puzzles/118') return { json: info }
  if (p === '/api/puzzles/118/board') return { json: shot.variant === 'me' ? boardWithMe : board }
}

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// 운영 Worker의 관리용 API(apps/worker/src/admin.ts)와 주고받는다.
// LINKLE_URL: 서비스 주소, LINKLE_ADMIN_TOKEN: 관리용 열쇠(저장소 비밀값)

function env(): { url: string; token: string } {
  const url = process.env.LINKLE_URL?.replace(/\/$/, '')
  const token = process.env.LINKLE_ADMIN_TOKEN
  if (!url || !token) throw new Error('LINKLE_URL과 LINKLE_ADMIN_TOKEN이 필요합니다')
  return { url, token }
}

/** 이미 쓴 출발·도착 제목을 받아 한 줄에 하나씩 쓴다. generate --exclude에 넘긴다 */
export async function fetchUsed(out: string): Promise<void> {
  const { url, token } = env()
  const res = await fetch(`${url}/api/admin/used`, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`used: ${res.status} ${await res.text()}`)
  const { titles } = (await res.json()) as { titles: string[] }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, titles.join('\n'))
  console.log(`이미 쓴 제목 ${titles.length}개 → ${out}`)
}

/** generate가 만든 후보(candidates.json)를 운영에 넣는다 */
export async function upload(file: string, pool: 'daily' | 'official'): Promise<void> {
  const { url, token } = env()
  const items = JSON.parse(readFileSync(file, 'utf8')) as unknown[]
  for (let i = 0; i < items.length; i += 50) {
    const res = await fetch(`${url}/api/admin/puzzles`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ pool, items: items.slice(i, i + 50) }),
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`upload: ${res.status} ${body}`)
    console.log(`올림 (${pool}): ${body}`)
  }
}

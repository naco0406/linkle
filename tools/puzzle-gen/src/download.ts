import { createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** 링크 지도에 필요한 덤프. 한 달에 두 번(1일, 20일 무렵) 새로 나온다. 합쳐서 약 540 MB */
export const DUMPS = ['page', 'redirect', 'page_props', 'linktarget', 'pagelinks'] as const

export async function download(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  const ua = process.env.WIKI_USER_AGENT || 'Linkle-puzzle-gen/0.1'
  // 덤프 서버는 동시 접속을 적게 받는다. 하나씩 받는다
  for (const name of DUMPS) {
    const url = `https://dumps.wikimedia.org/kowiki/latest/kowiki-latest-${name}.sql.gz`
    const res = await fetch(url, { headers: { 'user-agent': ua } })
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`)
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(join(dir, `kowiki-latest-${name}.sql.gz`)))
    console.log(`받음 ${name} (${res.headers.get('content-length')} bytes, ${res.headers.get('last-modified')})`)
  }
}

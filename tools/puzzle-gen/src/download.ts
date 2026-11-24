import { createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** 링크 지도에 필요한 덤프. 한 달에 두 번(1일, 20일 무렵) 새로 나온다. 합쳐서 약 540 MB */
export const DUMPS = ['page', 'redirect', 'page_props', 'linktarget', 'pagelinks'] as const

/** 한 파일을 받는 시도 횟수. 덤프 서버는 가끔 받는 도중에 멈춘다(2026-11-24: 13분 멈췄다가 ETIMEDOUT) */
export const ATTEMPTS = 4
/** 이만큼 아무것도 오지 않으면 멈춘 것으로 보고 끊은 뒤 다시 받는다 */
export const STALL_MS = 60_000
/** n번째 실패 뒤 기다리는 시간 */
export const backoffMs = (n: number) => Math.min(60_000, 5_000 * 2 ** (n - 1))

export async function download(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  const ua = process.env.WIKI_USER_AGENT || 'Linkle-puzzle-gen/0.1'
  // 덤프 서버는 동시 접속을 적게 받는다. 하나씩 받는다
  for (const name of DUMPS) {
    const url = `https://dumps.wikimedia.org/kowiki/latest/kowiki-latest-${name}.sql.gz`
    const file = join(dir, `kowiki-latest-${name}.sql.gz`)
    for (let attempt = 1; ; attempt++) {
      try {
        const info = await fetchOnce(url, file, ua)
        console.log(`받음 ${name} (${info})`)
        break
      } catch (e) {
        if (attempt >= ATTEMPTS) throw e
        const wait = backoffMs(attempt)
        console.log(`${name} 받기 실패(${attempt}/${ATTEMPTS}): ${(e as Error).message}. ${wait / 1000}초 뒤 다시`)
        await new Promise(r => setTimeout(r, wait))
      }
    }
  }
}

/** 한 번 받는다. 받는 도중 STALL_MS 동안 아무것도 오지 않으면 끊는다 */
async function fetchOnce(url: string, file: string, ua: string): Promise<string> {
  const ctrl = new AbortController()
  let timer = setTimeout(() => ctrl.abort(new Error('응답 없음')), STALL_MS)
  const kick = () => {
    clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(new Error(`${STALL_MS / 1000}초 동안 멈춤`)), STALL_MS)
  }
  try {
    const res = await fetch(url, { headers: { 'user-agent': ua }, signal: ctrl.signal })
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`)
    const watch = new Transform({
      transform(chunk, _enc, done) {
        kick()
        done(null, chunk)
      },
    })
    await pipeline(Readable.fromWeb(res.body as never), watch, createWriteStream(file), { signal: ctrl.signal })
    return `${res.headers.get('content-length')} bytes, ${res.headers.get('last-modified')}`
  } finally {
    clearTimeout(timer)
  }
}

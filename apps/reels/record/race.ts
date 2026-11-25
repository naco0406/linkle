// 두 번째 릴스(같이 달리기)의 재료를 실제 앱에서 찍는다.
// 나(방장)는 폰 크기 화면으로, 친구 셋은 따로 띄운 브라우저로 같은 방에 들어온다. 친구들은 정해 둔 대로 움직이고 반응을 보낸다.
// 장면은 대부분 정지 화면(public/rec/race-*.png, 1170×2532)이고, 룰렛만 짧은 영상(race-reveal.mp4)으로 찍는다.
// 누른 자리와 장면 이름은 public/rec/race.json에 남긴다.
//
// 먼저 `pnpm setup`(랜덤 풀에 떡볶이 → 화성을 넣는다), reels-worker(8821)와 reels-web(5211)을 띄워 둔다.

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright'

const BASE = process.env.REEL_BASE ?? 'http://127.0.0.1:5211'
const W = 390
const H = 844
const DPR = 3
const OUT = fileURLToPath(new URL('../public/rec/', import.meta.url))
const FRAMES = fileURLToPath(new URL('./frames-race', import.meta.url))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

type Shot = { name: string; taps: Array<{ x: number; y: number; label: string }> }
const shots: Shot[] = []

// 앞선 녹화의 판과 방 기록을 지운다
execFileSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'execute', 'linkle', '--local', '--persist-to', fileURLToPath(new URL('../.state', import.meta.url)), '--command', "DELETE FROM runs; DELETE FROM players; UPDATE puzzles SET clears = 3, plays = 3 WHERE kind = 'daily'; UPDATE puzzles SET clears = 0, plays = 0 WHERE kind = 'random';"],
  { cwd: process.env.REEL_WORKER ?? fileURLToPath(new URL('../../worker', import.meta.url)), stdio: 'ignore' },
)
mkdirSync(OUT, { recursive: true })
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

const browser = await chromium.launch()
const phone = (scale: number): Promise<BrowserContext> =>
  browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })

const me = await (await phone(DPR)).newPage()
const friends = await Promise.all([1, 2, 3].map(async () => (await phone(1)).newPage()))

/** 내 화면을 찍는다. taps: 이 장면에서 누를 곳(편집에서 탭 표시를 그린다) */
async function shot(name: string, taps: Array<{ target: Locator; label: string }> = []) {
  await me.evaluate(() => document.fonts.ready)
  await wait(250)
  const t: Shot['taps'] = []
  for (const { target, label } of taps) {
    const b = await target.boundingBox()
    if (b) t.push({ x: b.x + b.width / 2, y: b.y + b.height / 2, label })
  }
  await me.screenshot({ path: `${OUT}race-${name}.png` })
  shots.push({ name, taps: t })
  console.log('shot', name, t.map(x => x.label).join(', '))
}

const titleNow = (p: Page) => p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.shadowRoot)?.shadowRoot?.querySelector('h1.title')?.textContent ?? null)
async function pageReady(p: Page, before: string | null) {
  await p.waitForFunction(
    prev => {
      const busy = document.querySelector('.animate-pulse.bg-primary')
      const h1 = [...document.querySelectorAll('div')].find(d => d.shadowRoot)?.shadowRoot?.querySelector('h1.title')?.textContent
      return !busy && !!h1 && h1 !== prev
    },
    before,
    { timeout: 60_000 },
  )
}

/** 링크를 문서 화면의 위쪽 40% 자리로 가져온다(스크롤은 정지 화면이라 순간 이동) */
async function bring(link: Locator) {
  await link.evaluate(el => {
    const scroller = document.querySelector('.overflow-auto.overscroll-contain') as HTMLElement
    const r = el.getBoundingClientRect()
    const s = scroller.getBoundingClientRect()
    scroller.scrollTop = Math.max(0, scroller.scrollTop + r.top - s.top - s.height * 0.4)
  })
  await wait(200)
}

/** 친구 하나를 한 번 움직인다: 지금 문서에서 n번째로 보이는 링크를 누른다 */
async function wander(p: Page, n: number) {
  const before = await titleNow(p)
  const ok = await p.evaluate(k => {
    const root = [...document.querySelectorAll('div')].find(d => d.shadowRoot)?.shadowRoot
    const links = [...(root?.querySelectorAll('a[data-title]') ?? [])] as HTMLElement[]
    const el = links[Math.min(k, links.length - 1)]
    el?.click()
    return !!el
  }, n)
  if (ok) await pageReady(p, before).catch(() => {})
}

// 1. 커뮤니티 → 친구와 달리기
await me.goto(`${BASE}/community`)
const runCard = me.getByRole('button', { name: '방 만들기' }).first()
await runCard.waitFor()
await shot('community', [{ target: runCard, label: '방 만들기' }])
await runCard.click()
await me.waitForURL(/\/room\/[A-Z0-9]{4}/)
const code = me.url().split('/room/')[1]!.slice(0, 4)
await me.getByRole('img', { name: '방 QR' }).waitFor()
await shot('lobby-solo', [{ target: me.getByRole('button', { name: '링크 보내기' }), label: '링크 보내기' }])

// 2. 친구들이 하나씩 들어와 준비한다
for (const [i, f] of friends.entries()) {
  await f.goto(`${BASE}/room/${code}`)
  await f.getByRole('button', { name: '들어가기' }).click()
  await f.getByRole('button', { name: '준비', exact: true }).click()
  await me.waitForFunction(n => document.querySelectorAll('[aria-label="방장"]').length > 0 && document.body.innerText.includes(`${n}명, 최대`), i + 2)
  await wait(400)
  if (i === 1) {
    // 둘째 친구가 반응을 보낸다
    await f.getByRole('button', { name: '반응 🔥' }).first().click()
    await wait(350)
  }
  await shot(`lobby-${i + 2}`)
}
const go = me.getByRole('button', { name: /출발/ })
await shot('lobby-ready', [{ target: go, label: '출발' }])

// 3. 출발 → 룰렛. 이 구간만 영상으로 찍는다
const cdp = await me.context().newCDPSession(me)
const frames: Array<{ file: string; t: number }> = []
let n = 0
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `${FRAMES}/${String(n++).padStart(5, '0')}.jpg`
  writeFileSync(file, Buffer.from(data, 'base64'))
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, maxWidth: W * DPR, maxHeight: H * DPR })
const t0 = Date.now() / 1000
await go.click()
await pageReady(me, null)
const tEnd = Date.now() / 1000 + 0.3
await wait(300)
await cdp.send('Page.stopScreencast')
const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? tEnd) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1)!.file}'\n`
writeFileSync(`${FRAMES}/list.txt`, list)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${FRAMES}/list.txt`, '-vf', `fps=30,scale=${W * DPR}:${H * DPR}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', `${OUT}race-reveal.mp4`], { stdio: 'inherit' })
console.log(`reveal ${(tEnd - t0).toFixed(1)}s`)

// 4. 달리기. 정답 길(대한민국 → 무인 항공기 → 화성)을 내가 가고, 친구들은 아무 링크나 따라간다
for (const f of friends) await pageReady(f, null).catch(() => {})
await wait(600)
const steps = ['대한민국', '무인 항공기', '화성']
for (const [i, title] of steps.entries()) {
  const link = me.locator(`a[data-title="${title}"]`).first()
  await link.waitFor({ state: 'attached', timeout: 60_000 })
  if (i === 1) {
    // 친구들이 몇 번씩 움직여 레이스 바가 달라진 뒤, 셋째 친구의 반응
    await Promise.all(friends.map((f, k) => wander(f, 3 + k * 2)))
    await Promise.all(friends.slice(0, 2).map((f, k) => wander(f, 5 + k)))
    await friends[2]!.getByRole('button', { name: '반응 보내기' }).click()
    await friends[2]!.getByRole('button', { name: '반응 😱' }).first().click()
    await wait(350)
  }
  if (i === 2) await wander(friends[0]!, 2)
  // 그림이 늦게 들어오면 문서가 밀리므로, 다 들어온 뒤 한 번 더 맞춘다
  await bring(link)
  await me.waitForFunction(() => {
    const root = [...document.querySelectorAll('div')].find(d => d.shadowRoot)?.shadowRoot
    return [...(root?.querySelectorAll('img') ?? [])].every(img => (img as HTMLImageElement).complete)
  }, null, { timeout: 15_000 }).catch(() => {})
  await wait(400)
  await bring(link)
  await shot(`race-${i + 1}`, [{ target: link, label: title }])
  const before = await titleNow(me)
  await link.click()
  if (i < steps.length - 1) await pageReady(me, before)
}

// 5. 결과
await me.getByRole('button', { name: /한 판 더/ }).waitFor({ timeout: 60_000 })
await wait(1500)
await shot('results')
await me.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await wait(500)
await shot('results-bottom', [{ target: me.getByRole('button', { name: /한 판 더/ }), label: '한 판 더' }])

writeFileSync(`${OUT}race.json`, JSON.stringify({ code, width: W, height: H, dpr: DPR, shots }, null, 2))
await browser.close()
console.log(`${OUT}race.json`)

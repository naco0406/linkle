// 링클을 폰 크기로 띄워 대본대로 한 판을 플레이하며 녹화한다.
// 화면은 크롬 개발자 프로토콜의 스크린캐스트로 받는다(Playwright 기본 녹화보다 선명하다).
// 결과: public/rec/play.mp4(1170×2532, 30fps), public/rec/timeline.json(탭 위치와 장면 시각, 공유 문구)
//
// 먼저 `pnpm setup`으로 녹화용 DB를 만들고, reels-worker(8811)와 reels-web(5211)을 띄워 둔다.

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Locator, type Page } from 'playwright'

const BASE = process.env.REEL_BASE ?? 'http://127.0.0.1:5211'
const W = 390
const H = 844
const DPR = 3
const FPS = 30
const FRAMES = fileURLToPath(new URL('./frames', import.meta.url))
const OUT = fileURLToPath(new URL('../public/rec', import.meta.url))

/** 누를 링크(data-title) 차례. back은 되돌아가기 */
const SCRIPT: Array<{ link: string } | { back: true }> = [
  { link: process.env.REEL_L1 ?? '서울' },
  { link: process.env.REEL_DETOUR ?? '롯데월드타워' },
  { back: true },
  { link: '서울 이랜드 FC' },
  { link: '뉴발란스' },
]

type Mark = { t: number; kind: string; x?: number; y?: number; label?: string }
const marks: Mark[] = []
const frames: Array<{ file: string; t: number }> = []
const mark = (kind: string, extra: Omit<Mark, 't' | 'kind'> = {}) => marks.push({ t: Date.now() / 1000, kind, ...extra })
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// 앞선 녹화의 판을 지우고 친구 셋만 도착한 상태로 되돌린다(홈의 "지금까지 N명이 도착했어요")
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'linkle', '--local', '--persist-to', fileURLToPath(new URL('../.state', import.meta.url)), '--command', "DELETE FROM runs; DELETE FROM players; UPDATE puzzles SET clears = 3, plays = 3 WHERE kind = 'daily';"], { cwd: process.env.REEL_WORKER ?? fileURLToPath(new URL('../../worker', import.meta.url)), stdio: 'ignore' })

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
let n = 0
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `${FRAMES}/${String(n++).padStart(5, '0')}.jpg`
  writeFileSync(file, Buffer.from(data, 'base64'))
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

/** 요소 가운데를 누른다. 누른 자리를 기록해 두면 편집에서 탭 표시를 그 자리에 그린다 */
async function tap(target: Locator, label: string) {
  const box = await target.boundingBox()
  if (!box) throw new Error(`${label}: 화면에 없음`)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  mark('tap', { x, y, label })
  await wait(180)
  await page.touchscreen.tap(x, y)
}

/** 문서 스크롤 상자를 부드럽게 움직여 링크를 화면 위쪽 40% 자리로 가져온다 */
async function bringIntoView(link: Locator) {
  await link.evaluate(async el => {
    const scroller = document.querySelector('.overflow-auto.overscroll-contain') as HTMLElement
    const r = el.getBoundingClientRect()
    const s = scroller.getBoundingClientRect()
    const to = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + r.top - s.top - s.height * 0.4))
    const from = scroller.scrollTop
    const dist = Math.abs(to - from)
    if (dist < 4) return
    const dur = Math.min(2400, 500 + dist * 0.35)
    const t0 = performance.now()
    await new Promise<void>(done => {
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
        scroller.scrollTop = from + (to - from) * e
        if (p < 1) requestAnimationFrame(step)
        else done()
      }
      requestAnimationFrame(step)
    })
  })
}

const titleNow = (p: Page) =>
  p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.shadowRoot)?.shadowRoot?.querySelector('h1.title')?.textContent ?? null)

/** 로딩 띠가 사라지고 문서 제목이 앞의 것과 달라질 때까지 기다린다 */
async function pageReady(p: Page, before: string | null) {
  await p.waitForFunction(
    prev => {
      const busy = document.querySelector('.animate-pulse.bg-primary')
      const host = [...document.querySelectorAll('div')].find(d => d.shadowRoot)
      const h1 = host?.shadowRoot?.querySelector('h1.title')?.textContent
      return !busy && !!h1 && h1 !== prev
    },
    before,
    { timeout: 45_000 },
  )
  await p.evaluate(() => document.fonts.ready)
  mark('loaded', { label: (await titleNow(p)) ?? '' })
}

await page.goto(BASE)
await page.getByRole('button', { name: '시작' }).waitFor()
// 글꼴과 숫자가 다 들어온 뒤부터 찍는다
await page.evaluate(() => document.fonts.ready)
await wait(600)
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, maxWidth: W * DPR, maxHeight: H * DPR })
await wait(300)
mark('home')
await wait(2600)
await tap(page.getByRole('button', { name: '시작' }), '시작')
await pageReady(page, null)
mark('game')
await wait(1600)

for (const step of SCRIPT) {
  if ('back' in step) {
    await wait(900)
    const before = await titleNow(page)
    await tap(page.getByRole('button', { name: /되돌아가기$/ }), 'back')
    mark('back')
    await pageReady(page, before)
    await wait(1300)
    continue
  }
  const link = page.locator(`a[data-title="${step.link}"]`).first()
  await link.waitFor({ state: 'attached' })
  await bringIntoView(link)
  await wait(700)
  const before = await titleNow(page)
  await tap(link, step.link)
  mark('move', { label: step.link })
  if (step.link === '뉴발란스') break
  await pageReady(page, before)
  await wait(1400)
}

// 도착. 연속 기록 축하 화면이 먼저 뜨면 넘긴다(영상에는 쓰지 않는다)
const celebration = page.getByRole('dialog', { name: /연속/ })
const arrival = page.getByRole('heading', { name: /도착!/ })
await Promise.race([celebration.waitFor(), arrival.waitFor()])
if (await celebration.isVisible()) {
  mark('celebration')
  await wait(2200)
  await tap(celebration.getByRole('button').last(), 'celebration-done')
}
await arrival.waitFor()
mark('arrival')
const share = page.getByRole('button', { name: '결과 공유' })
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('결과 공유'))
  return b && !b.hasAttribute('disabled')
}, null, { timeout: 30_000 })
mark('emoji')
await wait(3000)
await tap(share, '결과 공유')
mark('share')
await wait(2200)
mark('end')
await cdp.send('Page.stopScreencast')
const shareText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
await browser.close()

// 프레임을 시간 순서대로 이어 일정한 30fps 영상으로 만든다
const t0 = frames[0]!.t
const end = marks.at(-1)!.t
const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1)!.file}'\n`
writeFileSync(`${FRAMES}/list.txt`, list)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${FRAMES}/list.txt`, '-vf', `fps=${FPS},scale=${W * DPR}:${H * DPR}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', `${OUT}/play.mp4`], { stdio: 'inherit' })

const timeline = {
  fps: FPS,
  width: W,
  height: H,
  dpr: DPR,
  duration: end - t0,
  marks: marks.map(m => ({ ...m, t: Math.max(0, m.t - t0) })),
  shareText,
}
writeFileSync(`${OUT}/timeline.json`, JSON.stringify(timeline, null, 2))
console.log(`${frames.length} frames, ${(end - t0).toFixed(1)}s`)
console.log(JSON.stringify(timeline, null, 2))

// 이야기판의 자막 자리를 SRT로 뽑는다. 편집 프로그램에서 불러와 글꼴과 위치를 정하면 된다.
import { writeFileSync, mkdirSync } from 'node:fs'
import { plain, SPEED, STORY_CAPTIONS } from '../src/storyPlan.ts'

const ts = (sec: number) => {
  const ms = Math.round(sec * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}
const srt = STORY_CAPTIONS.map((c, i) => `${i + 1}\n${ts(c.from / SPEED)} --> ${ts(c.to / SPEED)}\n${plain(c.text)}\n`).join('\n')
mkdirSync(new URL('../out', import.meta.url), { recursive: true })
writeFileSync(new URL('../out/linkle-story.srt', import.meta.url), srt)
console.log(srt)

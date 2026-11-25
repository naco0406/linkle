// 자막 자리를 SRT로 뽑는다. 편집 프로그램에서 불러와 글꼴과 위치를 정하면 된다.
//   out/linkle-story.srt  첫 번째 릴스(이야기판)
//   out/linkle-race.srt   두 번째 릴스(같이 달리기)
import { mkdirSync, writeFileSync } from 'node:fs'
import { RACE_CAPTIONS, RACE_SPEED } from '../src/racePlan.ts'
import { plain, SPEED, STORY_CAPTIONS } from '../src/storyPlan.ts'

const ts = (sec: number) => {
  const ms = Math.round(sec * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}
const srt = (caps: Array<{ from: number; to: number; text: string }>, speed: number) =>
  caps.map((c, i) => `${i + 1}\n${ts(c.from / speed)} --> ${ts(c.to / speed)}\n${plain(c.text)}\n`).join('\n')

mkdirSync(new URL('../out', import.meta.url), { recursive: true })
writeFileSync(new URL('../out/linkle-story.srt', import.meta.url), srt(STORY_CAPTIONS, SPEED))
writeFileSync(new URL('../out/linkle-race.srt', import.meta.url), srt(RACE_CAPTIONS, RACE_SPEED))
console.log('out/linkle-story.srt, out/linkle-race.srt')

// 이야기판에 쓸 정지 화면을 녹화에서 뽑는다(public/rec/story-*.png, 1170×2532).
// 영상 그대로 쓰면 스크롤과 로딩이 어지러워서, 순간 세 장만 쓴다.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type Mark = { t: number; kind: string; label?: string }
const REC = fileURLToPath(new URL('../public/rec/', import.meta.url))
const { marks } = JSON.parse(readFileSync(`${REC}timeline.json`, 'utf8')) as { marks: Mark[] }
const at = (kind: string, label?: string) => marks.find(m => m.kind === kind && (label === undefined || m.label === label))!.t

const SHOTS = {
  goal: at('tap', '뉴발란스') - 0.1, // 목표 문서 링크가 화면에 들어와 있는 순간(누르기 직전)
  arrival: at('arrival') + 1.4, // 도착 화면, 색이 다 붙은 뒤
  copied: at('share') + 0.7, // 결과 공유를 누른 뒤 "복사했어요" 알림
}
for (const [name, t] of Object.entries(SHOTS)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', `${REC}play.mp4`, '-frames:v', '1', `${REC}story-${name}.png`])
  console.log(`story-${name}.png  ${t.toFixed(2)}s`)
}

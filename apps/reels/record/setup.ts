// 릴스 녹화 전용 로컬 DB를 만든다. 평소 개발용 DB(apps/worker/.wrangler)와 따로 둔다.
// 오늘 날짜의 오늘의 문제를 "불고기 → 뉴발란스"로 넣고, 친구 셋(동휘, 민서, 진우)이 먼저 도착한 것으로 둔다.
// 녹화가 끝나면 지워도 된다(apps/reels/.state).

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const STATE = fileURLToPath(new URL('../.state', import.meta.url))
// 다른 작업이 진행 중인 작업 트리 대신 깨끗한 체크아웃의 worker로 녹화할 때 REEL_WORKER로 그 경로를 준다
const WORKER = process.env.REEL_WORKER ?? fileURLToPath(new URL('../../worker', import.meta.url))
export const NUMBER = 5
export const FRIENDS_CLEARED = 3

type Seed = { start: { id: number; title: string }; end: { id: number; title: string }; par: number; difficulty: string; solution: unknown }
const seeds = JSON.parse(readFileSync(new URL('../../worker/scripts/seed-puzzles.json', import.meta.url), 'utf8')) as Seed[]
const p = seeds.find(s => s.start.title === '불고기' && s.end.title === '뉴발란스')
if (!p) throw new Error('seed-puzzles.json에 불고기 → 뉴발란스가 없습니다')

const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const q = (s: string) => `'${s.replaceAll("'", "''")}'`

rmSync(STATE, { recursive: true, force: true })
const wrangler = (...args: string[]) => execFileSync('pnpm', ['exec', 'wrangler', ...args, '--local', '--persist-to', STATE], { cwd: WORKER, stdio: 'inherit' })
wrangler('d1', 'migrations', 'apply', 'linkle')
wrangler(
  'd1', 'execute', 'linkle', '--command',
  `INSERT INTO puzzles (kind, number, date, start_id, start_title, end_id, end_title, par, difficulty, solution, clears, plays, created_at) VALUES ` +
    `('daily', ${NUMBER}, ${q(kst)}, ${p.start.id}, ${q(p.start.title)}, ${p.end.id}, ${q(p.end.title)}, ${p.par}, ${q(p.difficulty)}, ${q(JSON.stringify(p.solution))}, ${FRIENDS_CLEARED}, ${FRIENDS_CLEARED}, ${Date.now()});`,
)
// 같이 달리기(두 번째 릴스)의 랜덤 풀: 한 문제만 넣어 룰렛이 늘 이 문제에서 멈추게 한다
const race = seeds.find(s => s.start.title === '떡볶이' && s.end.title === '화성')
if (!race) throw new Error('seed-puzzles.json에 떡볶이 → 화성이 없습니다')
wrangler(
  'd1', 'execute', 'linkle', '--command',
  `INSERT INTO puzzles (kind, number, date, start_id, start_title, end_id, end_title, par, difficulty, solution, created_at) VALUES ` +
    `('random', 1, NULL, ${race.start.id}, ${q(race.start.title)}, ${race.end.id}, ${q(race.end.title)}, ${race.par}, ${q(race.difficulty)}, ${q(JSON.stringify(race.solution))}, ${Date.now()});`,
)
console.log(`\n${STATE}: ${kst} #${NUMBER} ${p.start.title} → ${p.end.title}, 랜덤 #1 ${race.start.title} → ${race.end.title}`)

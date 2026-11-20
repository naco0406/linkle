// 로컬 개발용 문제 씨앗. 운영처럼 모든 문제에 정답 경로와 난이도가 있다.
// SQL 파일을 만들기만 한다. 실제로 넣는 것은 `pnpm db:seed`가 wrangler로 한다. 운영 DB에는 쓰지 않는다.
// seed-puzzles.json은 tools/puzzle-gen의 solve 명령으로 만들었다(링크 지도의 최단 경로를 게임 규칙으로 확인한 길).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { daysBetween, kstDate } from '@linkle/core'

type Hop = { id: number; title: string; via: string }
type Seed = { start: { id: number; title: string }; end: { id: number; title: string }; par: number; difficulty: string; solution: Hop[] }

const PAIRS = JSON.parse(readFileSync(new URL('./seed-puzzles.json', import.meta.url), 'utf8')) as Seed[]

// 번호를 날짜에서 계산하면 며칠 뒤에 다시 돌려도 같은 날짜에 같은 번호와 같은 문제가 나온다.
// 그래서 이미 있는 날짜는 건너뛰기만 하면 되고(INSERT OR IGNORE), 진행 중인 판이 가리키는 문제가 바뀌지 않는다.
const EPOCH = '2026-11-19'
const DAYS = 15
const DAY_MS = 24 * 60 * 60 * 1000
const OUT = '.wrangler/seed.sql'

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`

const now = Date.now()
const rows: string[] = []
for (let i = 0; i < DAYS; i++) {
  const date = kstDate(now + i * DAY_MS)
  const number = daysBetween(EPOCH, date) + 1
  if (number < 1) continue
  const p = PAIRS[(number - 1) % PAIRS.length]!
  rows.push(
    `('daily', ${number}, ${quote(date)}, ${p.start.id}, ${quote(p.start.title)}, ${p.end.id}, ${quote(p.end.title)}, ${p.par}, ${quote(p.difficulty)}, ${quote(JSON.stringify(p.solution))}, ${now})`,
  )
}
if (rows.length === 0) throw new Error(`기기 시계가 ${EPOCH}보다 앞서 있어 넣을 문제가 없습니다`)

// 예전 씨앗(정답 경로 없음)은 아무도 시작하지 않았으면 지우고 새로 넣는다. 시작한 판이 있으면 남겨 둔다
const sql =
  `DELETE FROM puzzles WHERE kind = 'daily' AND solution IS NULL AND id NOT IN (SELECT puzzle_id FROM runs);\n` +
  `INSERT OR IGNORE INTO puzzles (kind, number, date, start_id, start_title, end_id, end_title, par, difficulty, solution, created_at) VALUES\n${rows.join(',\n')};\n` +
  // 판이 남아 지우지 못한 예전 씨앗에도 같은 쌍이면 정답을 붙인다
  PAIRS.map(
    p => `UPDATE puzzles SET par = ${p.par}, difficulty = ${quote(p.difficulty)}, solution = ${quote(JSON.stringify(p.solution))} WHERE start_id = ${p.start.id} AND end_id = ${p.end.id} AND solution IS NULL;\n`,
  ).join('')

mkdirSync('.wrangler', { recursive: true })
writeFileSync(OUT, sql)
console.log(`${OUT}: 오늘(${kstDate(now)})부터 ${rows.length}일치`)

// 로컬 개발용 문제 씨앗. 문제 출제(구현 순서 8번)가 생기기 전까지 오늘의 문제가 비지 않게 한다.
// SQL 파일을 만들기만 한다. 실제로 넣는 것은 `pnpm db:seed`가 wrangler로 한다.
// 운영 DB에는 쓰지 않는다. 여기 쌍들은 문서 id만 확인했고, 난이도나 도달 가능 여부는 검수하지 않았다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { daysBetween, kstDate } from '@linkle/core'

type Seed = [startId: number, startTitle: string, endId: number, endTitle: string]

// ko.wikipedia의 문서 id. 2026-11-19에 action=query로 확인했다(넘겨주기를 푼 최종 문서, 동음이의 문서 아님)
const PAIRS: Seed[] = [
  [7761, '불고기', 1043098, '뉴발란스'],
  [436065, '김치', 2602, '아이작 뉴턴'],
  [2789, '세종', 15907, '커피'],
  [1455, '축구', 2679, '피아노'],
  [96795, '라면', 1840, '알베르트 아인슈타인'],
  [6160, '한강', 44293, '초콜릿'],
  [93349, '고양이', 93333, '인터넷'],
  [71589, '제주도', 4996, '올림픽'],
  [47026, '지하철', 143534, '바나나'],
  [48497, '태권도', 72789, '달'],
  [22697, '비빔밥', 4470, '레오나르도 다 빈치'],
  [2174, '독도', 66200, '재즈'],
  [9977, '스마트폰', 8085, '공룡'],
  [2359, '떡볶이', 518, '화성'],
  [8084, '바둑', 8067, '펭귄'],
  [487516, '한글', 8542, '로마 제국'],
  [64502, '김밥', 61684, '우주정거장'],
  [6129, '판소리', 45989, '자전거'],
]

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
  const [startId, startTitle, endId, endTitle] = PAIRS[(number - 1) % PAIRS.length]!
  rows.push(`('daily', ${number}, ${quote(date)}, ${startId}, ${quote(startTitle)}, ${endId}, ${quote(endTitle)}, ${now})`)
}
if (rows.length === 0) throw new Error(`기기 시계가 ${EPOCH}보다 앞서 있어 넣을 문제가 없습니다`)

const sql = `INSERT OR IGNORE INTO puzzles (kind, number, date, start_id, start_title, end_id, end_title, created_at) VALUES\n${rows.join(',\n')};\n`

mkdirSync('.wrangler', { recursive: true })
writeFileSync(OUT, sql)
console.log(`${OUT}: 오늘(${kstDate(now)})부터 ${rows.length}일치`)

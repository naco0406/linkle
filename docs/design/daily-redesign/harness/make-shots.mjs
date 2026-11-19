// 캡처 설정(shots.json)을 만든다. 끝난 판은 오늘 날짜여야 화면에 남으므로 실행할 때마다 새로 만든다.
import fs from 'node:fs'
const now = Date.now()
const today = new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
const P = (id, title) => ({ id, title })
const puzzle = { id: 1, kind: 'daily', number: 1, date: today, start: P(7761, '불고기'), end: P(1043098, '뉴발란스') }
const startedAt = now - 82_000
const events = [
  { type: 'link', to: P(145056, '돼지고기'), via: '돼지고기', at: 9000 },
  { type: 'back', to: P(7761, '불고기'), at: 14000 },
  { type: 'link', to: P(249, '대한민국'), via: '대한민국', at: 21000 },
  { type: 'link', to: P(1455, '축구'), via: '축구', at: 38000 },
  { type: 'link', to: P(102860, '라리가'), via: '프리메라리가', at: 52000 },
  { type: 'link', to: P(128527, '세비야 FC'), via: '세비야 FC', at: 66000 },
  { type: 'link', to: P(1043098, '뉴발란스'), via: '뉴발란스', at: 82000 },
]
const run = (over) => ({ v: 1, mode: 'daily', puzzle, runId: 'capture', phase: 'playing', startedAt, finishedAt: null, events: [], leads: {}, flags: [], emoji: null, result: null, outbox: 'none', ...over })
const store = r => ({ 'linkle:run:v1': { state: { run: r, clockOffset: 0 }, version: 1 } })
const playing = run({ startedAt: now - 66_000, events: events.slice(0, 5) })
const finished = run({ phase: 'finished', finishedAt: startedAt + 82000, events, emoji: ['🟥', '⏪', '🟥', '🟨', '🟥', '🟧', '🏁'] })
const phone = [390, 800]
const cfg = {
  dist: '../../../../apps/web/dist',
  apiPrefix: '/api/',
  viewport: [1280, 800], scale: 2,
  allowHosts: ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'ko.wikipedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org'],
  shots: [
    { name: 'home', path: '/', viewport: phone, waitFor: 'role=button[name="시작"]',
      pins: [{ n: 1, loc: 'text=매일 위키피디아 탐험하기' }, { n: 2, loc: 'role=button[name="게임 방법"]' }, { n: 3, loc: 'text=All rights reserved' }],
      probe: { 로고: 'role=heading[name="Linkle"]', 번호: 'text=#1', 문구: 'text=매일 위키피디아 탐험하기', '주 버튼': 'role=button[name="시작"]', 바닥글: 'text=All rights reserved' } },
    { name: 'game', path: '/', viewport: phone, storage: store(playing), waitFor: 'css=h1.title', actions: [{ wait: 1500 }],
      pins: [{ n: 4, loc: 'text=목표:', at: 'right' }, { n: 5, loc: 'css=footer >> text=현재 문서' }, { n: 6, loc: 'role=button[name="이전 문서로"]', at: 'right' }],
      probe: { 머리: 'css=header', 바닥: 'css=footer', 목표: 'text=목표:', '바닥 글자': 'css=footer span >> nth=0', 값: 'css=footer span span >> nth=0', 뒤로: 'role=button[name="이전 문서로"]' } },
    { name: 'result', path: '/', viewport: phone, storage: store(finished), waitFor: 'role=button[name="결과 공유"]',
      pins: [{ n: 7, loc: 'text=1번째 링클을 클리어했습니다!', at: 'top' }, { n: 8, loc: 'css=[aria-label="경로의 유사도"]' }, { n: 9, loc: 'role=button[name="결과 공유"]' }],
      probe: { 제목: 'text=1번째 링클을 클리어했습니다!', '경로 상자': 'css=.border-line-blue', 통계: 'text=소요 시간' } },
    { name: 'game-desktop', path: '/', storage: store(playing), waitFor: 'css=h1.title', actions: [{ wait: 1500 }] },
    { name: 'home-desktop', path: '/', waitFor: 'role=button[name="시작"]' },
  ],
}
fs.writeFileSync(new URL('./shots.json', import.meta.url), JSON.stringify(cfg, null, 2))
console.log('shots.json', today)

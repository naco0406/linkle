// 캡처 설정을 만든다. 판의 시각이 지금 기준이어야 화면이 자연스러워서 실행할 때마다 새로 만든다.
import fs from 'node:fs'
import { puzzle } from './world.mjs'
const now = Date.now()
const P = (id, title) => ({ id, title })
const events = [
  { type: 'link', to: P(1500, '카카오'), via: '카카오', at: 11_000 },
  { type: 'link', to: P(312, '멕시코'), via: '멕시코', at: 27_000 },
  { type: 'link', to: P(5531, '천문학'), via: '천문학', at: 49_000 },
  { type: 'link', to: P(1987, '블랙홀'), via: '블랙홀', at: 88_000 },
]
const base = { v: 1, mode: 'community', puzzle, runId: 'capture-118', flags: [], leads: {}, outbox: 'none' }
const playing = { ...base, phase: 'playing', startedAt: now - 52_000, finishedAt: null, events: events.slice(0, 2), emoji: null, result: null }
const finished = { ...base, phase: 'finished', startedAt: now - 300_000, finishedAt: now - 300_000 + 88_000, events, emoji: ['🟥', '🟧', '🟩', '🏁'], result: { order: 10, rank: 2 } }
const store = (others, seen = []) => ({ 'linkle:run:v1': { state: { run: null, others, clockOffset: 0, seen }, version: 1 }, 'linkle:player:v1': { id: '6f1d2c4a-8b3e-4f7a-9c21-5d8e0b7a3f64' } })
const phone = [390, 800]
const cfg = {
  dist: '../../../../apps/web/dist', mocks: './mocks.mjs', apiPrefix: '/api/', viewport: [1280, 800], scale: 2,
  allowHosts: ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'ko.wikipedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org'],
  shots: [
    { name: 'community', path: '/community', viewport: phone, storage: store({}), waitFor: 'text=#18', displayScale: 0.5,
      pins: [{ n: 1, loc: 'role=heading[level=1]', at: 'right' }, { n: 2, loc: 'role=tablist', at: 'top' }],
      probe: { '제목': 'role=heading[level=1]', '설명': 'main header p', '정렬': 'role=tablist', '정렬 칸(고름)': 'role=tab[selected=true]', '카드': 'css=main section >> nth=0', '줄': 'css=main li >> nth=0', '줄 제목': 'css=main li a span span >> nth=0', '꼬리표': 'css=main li a > span >> nth=0', '아래 탭': 'css=nav.tabbar' } },
    { name: 'intro', path: '/community/118', viewport: phone, storage: store({}), waitFor: 'role=button[name="시작"]', displayScale: 0.5,
      pins: [{ n: 3, loc: 'css=main section >> nth=0' }, { n: 4, loc: 'css=main section >> nth=1', at: 'top' }],
      probe: { '주 버튼': 'role=button[name="시작"]', '문제 카드': 'css=main section >> nth=0', '숫자 타일': 'css=main dl > div >> nth=0', '잠긴 칸': 'text=출발 문서' } },
    { name: 'game', path: '/community/118', viewport: phone, storage: store({ 118: playing }), waitFor: 'css=footer', wait: 2500, displayScale: 0.5,
      pins: [{ n: 5, loc: 'css=header' }, { n: 6, loc: 'css=footer' }],
      probe: { '머리': 'css=header', '목표 이름': 'css=header b', '지나온 길': 'css=[aria-label="지나온 길"] >> nth=1', '바닥': 'css=footer', '되돌아가기': 'css=footer button' } },
    { name: 'arrival', path: '/community/118', viewport: [390, 1100], storage: store({ 118: finished }), variant: 'me', waitFor: 'text=순위표', displayScale: 0.5,
      pins: [{ n: 7, loc: 'role=button[name="결과 공유"]' }, { n: 8, loc: 'css=section[aria-label="순위표"]' }],
      probe: { '도착 제목': 'role=heading[level=1]', '타일': 'css=dl > div >> nth=0', '경로 줄': 'css=ol li >> nth=1', '결과 공유': 'role=button[name="결과 공유"]', '글자 버튼': 'role=button[name="문제로 돌아가기"]', '순위 줄(나)': 'css=ol li.bg-secondary' } },
  ],
}
fs.writeFileSync(new URL('./shots.json', import.meta.url), JSON.stringify(cfg, null, 2))
console.log('ok')

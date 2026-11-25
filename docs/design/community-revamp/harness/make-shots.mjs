import fs from 'node:fs'
import { inbox } from './world.mjs'
const store = () => ({ 'linkle:run:v1': { state: { run: null, others: {}, clockOffset: 0, seen: [] }, version: 1 }, 'linkle:player:v1': { id: '6f1d2c4a-8b3e-4f7a-9c21-5d8e0b7a3f64' }, 'linkle:inbox:v1': inbox })
const cfg = {
  dist: '../../../../apps/web/dist', mocks: './mocks.mjs', apiPrefix: '/api/', viewport: [1280, 800], scale: 2,
  allowHosts: ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'],
  shots: [
    { name: 'community', path: '/community', viewport: [390, 1180], storage: store(), waitFor: 'text=#31', wait: 600,
      pins: [
        { n: 1, loc: 'main header p' },
        { n: 2, loc: 'text=친구와 달리기' },
        { n: 3, loc: 'text=친구에게 내기' },
        { n: 4, loc: 'text=펭귄님의 도전장', at: 'right', dx: 8 },
        { n: 5, loc: 'css=main li >> nth=3' },
      ] },
    { name: 'mine', path: '/community/mine', viewport: [390, 800], storage: store(), waitFor: 'text=떡볶이', wait: 400,
      pins: [{ n: 6, loc: 'main header p' }] },
    { name: 'archive', path: '/archive', viewport: [390, 800], storage: store(), waitFor: 'text=13번째 링클', wait: 400,
      pins: [{ n: 7, loc: 'text=13번째 링클' }] },
    { name: 'intro', path: '/community/130', viewport: [390, 1000], storage: store(), waitFor: 'role=button[name="시작"]', wait: 400,
      pins: [{ n: 8, loc: 'text=링클 커뮤니티 #30' }] },
  ],
}
fs.writeFileSync(new URL('./shots.json', import.meta.url), JSON.stringify(cfg, null, 2))
console.log('ok')

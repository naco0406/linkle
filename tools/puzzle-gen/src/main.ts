import { join } from 'node:path'
import { buildGraph } from './graph.ts'

// 문제 생성 도구.
//   download  덤프 받기 (data/)
//   build     링크 지도 만들기 (data/graph/)
//   used      운영에서 이미 쓴 제목 받기 (LINKLE_URL, LINKLE_ADMIN_TOKEN)
//   upload    만든 후보를 운영에 넣기 (--pool daily|official)
//   solve     정해진 출발·도착 쌍의 정답 경로 찾기 (--in pairs.json → out/solved.json)
//   generate  후보 고르기 → 게임 규칙으로 경로 확인 → out/queue.sql(오늘의 문제 대기열) 또는 --pool official이면 out/official.sql(커뮤니티)

const here = new URL('..', import.meta.url).pathname
const DATA = join(here, 'data')
const GRAPH = join(DATA, 'graph')
const OUT = join(here, 'out')

const [cmd, ...args] = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1]! : fallback
}

if (cmd === 'build') {
  await buildGraph(DATA, GRAPH)
} else if (cmd === 'download') {
  const { download } = await import('./download.ts')
  await download(DATA)
} else if (cmd === 'generate') {
  const { generate } = await import('./generate.ts')
  const { readFileSync } = await import('node:fs')
  // --exclude <파일>: 한 줄에 제목 하나. 이미 쓴 문서를 빼고 고른다
  const exclude = args.includes('--exclude') ? readFileSync(opt('exclude', ''), 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : []
  await generate({
    graphDir: GRAPH,
    outDir: OUT,
    count: Number(opt('count', '40')),
    seed: Number(opt('seed', String(Date.now() % 1e9))),
    pool: opt('pool', 'daily') === 'official' ? 'official' : 'daily',
    exclude,
  })
} else if (cmd === 'solve') {
  // --in <파일>: [{start:{id,title}, end:{id,title}}] → out/solved.json
  const { solve } = await import('./solve.ts')
  await solve(GRAPH, opt('in', join(OUT, 'pairs.json')), opt('out', join(OUT, 'solved.json')))
} else if (cmd === 'used') {
  const { fetchUsed } = await import('./remote.ts')
  await fetchUsed(opt('out', join(OUT, 'used.txt')))
} else if (cmd === 'upload') {
  const { upload } = await import('./remote.ts')
  await upload(opt('file', join(OUT, 'candidates.json')), opt('pool', 'daily') === 'official' ? 'official' : 'daily')
} else {
  console.log('사용법: node src/main.ts download | build | generate [--count 40] [--seed 1] [--pool daily|official] [--exclude titles.txt]')
  process.exit(1)
}

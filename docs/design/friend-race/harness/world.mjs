// 친구와 겨루기 시안의 한 세계. 오늘은 2026-12-03(목), 오늘의 링클 #14.
// 나는 "파란 수달 4821". 친구 셋과 단톡방에 있다. 커뮤니티에는 링클이 낸 문제가 18개 있다.
export const TODAY = '2026-12-03'
export const ME = '파란 수달 4821'
export const FRIENDS = ['졸린 펭귄 2093', '엉뚱한 여우 7310', '다정한 고래 5148']
// [번호, 난이도, 도전, 도착]
const C = [
  [18, 'hard', 23, 9], [17, 'normal', 41, 27], [16, 'easy', 57, 49], [15, 'normal', 66, 38],
  [14, 'hard', 72, 25], [13, 'easy', 80, 71], [12, 'normal', 95, 60], [11, 'normal', 103, 74],
]
export const community = C.map(([number, difficulty, plays, clears]) => ({ id: 100 + number, kind: 'official', number, author: '링클', plays, clears, difficulty }))
export const puzzle = { id: 118, kind: 'official', number: 18, date: null, start: { id: 21706, title: '초콜릿' }, end: { id: 1987, title: '블랙홀' } }
export const info = { ...community[0], date: null, medianMoves: 5 }
export const board = {
  total: 9,
  me: null,
  top: [
    { rank: 1, name: '날쌘 치타 1184', moves: 4, ms: 71_000, verified: true, me: false },
    { rank: 2, name: '꼼꼼한 부엉이 6620', moves: 4, ms: 128_000, verified: true, me: false },
    { rank: 3, name: '명랑한 라쿤 3307', moves: 5, ms: 96_000, verified: true, me: false },
    { rank: 4, name: '수줍은 미어캣 9051', moves: 5, ms: 154_000, verified: true, me: false },
    { rank: 5, name: '느긋한 하마 2716', moves: 6, ms: 203_000, verified: false, me: false },
  ],
}
export const boardWithMe = { ...board, total: 10, top: [board.top[0], { rank: 2, name: ME, moves: 4, ms: 88_000, verified: false, me: true }, ...board.top.slice(1, 4).map(r => ({ ...r, rank: r.rank + 1 }))] }

// 커뮤니티 재기획 시안의 한 세계. 오늘은 2026-12-03(목), 오늘의 링클 #14.
// 나는 "파란 수달 4821". 친구 셋과 단톡방에 있다. 커뮤니티에는 링클이 낸 문제와 사람들이 올린 문제가 섞여 있다.
export const TODAY = '2026-12-03'
export const ME = '파란 수달 4821'
// [번호, 종류, 출제자, 난이도, 도전, 도착]
const C = [
  [31, 'community', '엉뚱한 여우 7310', 'normal', 14, 6],
  [30, 'official', '링클', 'hard', 23, 9],
  [29, 'community', '수줍은 미어캣 9051', 'easy', 37, 30],
  [28, 'official', '링클', 'normal', 41, 27],
  [27, 'official', '링클', 'easy', 57, 49],
  [26, 'community', '날쌘 치타 1184', 'hard', 19, 4],
  [25, 'official', '링클', 'normal', 66, 38],
  [24, 'official', '링클', 'hard', 72, 25],
]
export const community = C.map(([number, kind, author, difficulty, plays, clears]) => ({ id: 100 + number, kind, number, author, plays, clears, difficulty }))
export const info = { ...community[1], date: null, medianMoves: 5 }
export const board = {
  total: 9,
  me: null,
  top: [
    { rank: 1, name: '날쌘 치타 1184', moves: 4, ms: 71_000, verified: true, me: false },
    { rank: 2, name: '꼼꼼한 부엉이 6620', moves: 4, ms: 128_000, verified: true, me: false },
    { rank: 3, name: '명랑한 라쿤 3307', moves: 5, ms: 96_000, verified: true, me: false },
  ],
}
const day = d => `2026-${d}`
export const archive = [
  [13, '12-02', 58], [12, '12-01', 71], [11, '11-30', 64], [10, '11-29', 49], [9, '11-28', 77], [8, '11-27', 52], [7, '11-26', 60],
].map(([number, date, finished]) => ({ id: number, number, date: day(date), finished }))
export const mine = [
  { id: 133, number: 33, status: 'unlisted', start_title: '떡볶이', end_title: '인공위성', author_moves: 5, plays: 6, clears: 4, shorter: 1, created_at: Date.now() - 86400_000, canPublish: true, solution: [] },
  { id: 132, number: 32, status: 'draft', start_title: '고양이', end_title: '조선', author_moves: null, plays: 0, clears: 0, shorter: 0, created_at: Date.now() - 3600_000, canPublish: false, solution: [] },
]
const now = Date.now()
export const inbox = [
  { code: 'Q7KD2M', puzzleId: 128, name: '졸린 펭귄 2093', kind: 'official', number: 28, ms: 132_000, moves: 6, at: now - 40 * 60_000 },
  { code: 'H3XA9P', puzzleId: 133, name: '다정한 고래 5148', kind: 'community', number: 25, ms: 201_000, moves: 7, at: now - 5 * 3600_000 },
]

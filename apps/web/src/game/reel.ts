import { fetchSummary } from './summary'

// 공개 연출의 릴에 지나가는 미끼 제목(설계 문서 16.3.3). 실제 문제는 서버가 이미 정했고, 이 제목들은 장면일 뿐이다.
// 모든 기기가 같은 seed로 같은 순서를 만들어 같은 장면을 본다.

export const DECOYS = [
  '피아노', '아이슬란드', '태양계', '커피', '바로크 음악', '비트코인', '판소리', '모차르트', '바이킹', '산업 혁명',
  '피라미드', '태권도', '세종대왕', '반도체', '나폴레옹', '광합성', '셰익스피어', '한강', '판다', '김치',
  '알프스산맥', '오로라', '마라톤', '화산', '블랙홀', '초콜릿', '인터넷', '상대성 이론', '로마 제국', '스마트폰',
  '고양이', '비빔밥', '아인슈타인', '르네상스', '고려청자', '송나라', '이탈리아', '베네치아', '비단길', '도자기',
  '올림픽', '이집트', '나일강', '런던', '글로브 극장', '서울', '조선', '훈민정음', '과학', '전자 공학',
  '에티오피아', '유럽', '17세기', '은행', '피렌체', '식물', '중국', '영국', '카카오', '멕시코',
  '천문학', '공룡', '빙하기', '고래', '펭귄', '남극', '사하라 사막', '아마존강', '에베레스트산', '지중해',
  '비틀즈', '재즈', '오페라', '레오나르도 다 빈치', '빈센트 반 고흐', '클로드 모네', '인상주의', '수학', '피타고라스', '미적분',
  '컴퓨터', '전화', '전기', '증기 기관', '자동차', '비행기', '로켓', '달', '화성', '목성',
  '축구', '야구', '농구', '체스', '바둑', '불고기', '라면', '떡볶이', '녹차', '와인',
]

/** seed로 정해지는 섞기. 기기마다 같은 순서가 나온다 */
export function reelOf(seed: number, length: number, exclude: string[]): string[] {
  let x = seed >>> 0 || 1
  const next = () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 2 ** 32
  }
  const pool = DECOYS.filter(t => !exclude.includes(t))
  return Array.from({ length }, () => pool[Math.floor(next() * pool.length)]!)
}

export { fetchSummary }

/** 손잡이를 당긴 듯 빨라지는 시간(ms) */
export const SPIN_UP_MS = 280
/** 목표 칸을 지나쳤다가 제자리로 딸깍 돌아오는 시간(ms) */
export const SETTLE_MS = 320
/** 지나치는 거리(칸) */
const OVERSHOOT = 0.16

/**
 * 릴의 위치(칸 단위)와 속도(칸/초). 서버 시각 하나로 정해지므로 모든 기기가 같은 장면을 본다.
 *   0 ~ SPIN_UP_MS      속도가 0에서 최고까지 오른다
 *   그 뒤 ~ total       3차 곡선으로 길게 느려진다. 마지막 몇 칸은 한 칸씩 넘어가는 것이 보인다(실제 룰렛처럼)
 *                       목표 칸을 살짝 지나친 자리에서 선다
 *   total ~ +SETTLE_MS  제자리로 딸깍 돌아온다
 * elapsed: 돌기 시작한 뒤 지난 시간, total: 설 때까지 걸리는 시간, distance: 목표 칸까지 지나갈 칸 수
 */
export function reelAt(elapsed: number, total: number, distance: number): { p: number; v: number; done: boolean } {
  const t = Math.max(0, elapsed)
  const ta = SPIN_UP_MS
  const far = distance + OVERSHOOT
  // 빨라지는 구간 끝의 속도가 느려지는 구간 처음 속도와 같게 맞춘다
  const vmax = (3 * far) / (total + 0.5 * ta)
  const d0 = (vmax * ta) / 2
  if (t < ta) return { p: (vmax * t * t) / (2 * ta), v: ((vmax * t) / ta) * 1000, done: false }
  if (t < total) {
    const x = (t - ta) / (total - ta)
    const rest = far - d0
    return { p: d0 + rest * (1 - (1 - x) ** 3), v: ((3 * rest * (1 - x) ** 2) / (total - ta)) * 1000, done: false }
  }
  const u = Math.min(1, (t - total) / SETTLE_MS)
  const back = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
  return { p: far - OVERSHOOT * back, v: 0, done: u >= 1 }
}

// 로그인 없이 순위표에 쓰는 이름. 기기 id에서 정해지므로 같은 기기는 늘 같은 이름이다.
// 사용자가 직접 쓰는 이름을 받지 않는다: 욕설·사칭을 걸러야 할 글이 서버에 생기지 않는다(설계 문서 12.2).

const ADJECTIVES = [
  '파란', '노란', '빨간', '초록', '보라', '하얀', '까만', '분홍', '주황', '하늘색',
  '용감한', '느긋한', '재빠른', '조용한', '명랑한', '꼼꼼한', '씩씩한', '수줍은', '엉뚱한', '다정한',
  '졸린', '배고픈', '반짝이는', '포근한', '날쌘', '든든한', '상냥한', '호기심 많은', '부지런한', '똑똑한',
] as const
const ANIMALS = [
  '수달', '고양이', '펭귄', '여우', '부엉이', '다람쥐', '고래', '판다', '토끼', '거북이',
  '해달', '사슴', '두더지', '코알라', '알파카', '오리', '참새', '돌고래', '고슴도치', '햄스터',
  '물개', '너구리', '치타', '앵무새', '라쿤', '미어캣', '오소리', '하마', '얼룩말', '두루미',
] as const

/** 문자열을 32비트 수로 섞는다(FNV-1a). 암호용이 아니라 이름을 고르게 고르기 위한 것이다 */
function hash(s: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** "파란 수달 4821" */
export function nicknameOf(playerId: string): string {
  const id = playerId.toLowerCase()
  const a = ADJECTIVES[hash(id, 1) % ADJECTIVES.length]!
  const b = ANIMALS[hash(id, 2) % ANIMALS.length]!
  const n = (hash(id, 3) % 9000) + 1000
  return `${a} ${b} ${n}`
}

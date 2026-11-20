import { inDegree, outDegree, type Graph } from './graph.ts'

// 문제 후보를 고르는 규칙. 위키백과도 파일도 모르는 순수 함수라 작은 가짜 지도로 시험한다.

/** 출발·도착으로 쓰지 않는 제목. 날짜·목록처럼 게임으로 재미없거나, 사건·사고처럼 게임 소재로 부적절한 것 */
const BORING = [/^\d+년(대)?$/, /^\d+세기$/, /^\d+월( \d+일)?$/, /^기원전/, /목록|일람|연표/, /\(/, /^\d/]
const SENSITIVE =
  /사건|사고|참사|학살|테러|전쟁|대전$|내전|살인|자살|폭동|쿠데타|홀로코스트|나치|대통령|선거|정당|국회의원|성교|성기|섹스|체위|사정$|자위|포르노|성매매|매춘|마약|범죄|사형|위안부|지진|재난|전염병|팬데믹|감염증|암$|질환|장애|저격|암살|운동$|게이트$|스캔들|논란|의혹|파문|유두|유방|생식|염$|보수주의|진보주의|행정부|정부$|핵무기|히틀러|스탈린|마오쩌둥|김일성|김정일|김정은|무솔리니|문선명/

/** 한글이 들어간 2~16자. 기호로 시작하는 제목(.hr 같은 도메인)은 빼고, 너무 긴 제목은 화면에서 잘린다 */
export function titleOk(title: string): boolean {
  return title.length >= 2 && title.length <= 16 && /[가-힣]/.test(title) && !BORING.some(re => re.test(title)) && !SENSITIVE.test(title)
}

export type Rules = {
  /** 출발 문서는 링크가 충분해야 한다. 게임은 링크의 일부(탐색 상자 등)를 지운다 */
  minOut: number
  /** 도착 문서로 들어오는 링크. 너무 적으면 찾을 수 없고, 너무 많으면 어디서나 닿는다 */
  minIn: number
  maxIn: number
  /** 링크 지도에서의 최단 거리. 이 아래는 너무 쉽다(게임에서도 이보다 짧을 수 없다) */
  minDist: number
  maxDist: number
}

export const RULES: Rules = { minOut: 40, minIn: 40, maxIn: 5000, minDist: 3, maxDist: 4 }

export const canStart = (g: Graph, n: number, r: Rules = RULES) => outDegree(g, n) >= r.minOut
export const canEnd = (g: Graph, n: number, r: Rules = RULES) => inDegree(g, n) >= r.minIn && inDegree(g, n) <= r.maxIn

export type Difficulty = 'easy' | 'normal' | 'hard'

/**
 * 예상 난이도. 최단 거리(par), 그 거리로 가는 길의 수, 도착 문서로 들어오는 링크 수로 매긴다.
 * 링크 지도에는 게임이 지우는 링크도 있어 길의 수가 실제보다 많게 나온다. 실제 플레이 기록으로 기준을 고쳐 간다.
 */
export function difficultyOf(par: number, ways: number, endIn: number): Difficulty {
  if (par <= 3 && ways >= 20) return 'easy'
  if (par >= 4 && (ways <= 6 || endIn <= 150)) return 'hard'
  return 'normal'
}

/** 시드가 같으면 같은 수열. 같은 날 다시 돌려도 같은 후보가 나오게 한다 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

import { inDegree, outDegree, type Graph } from './graph.ts'

// 문제 후보를 고르는 규칙. 위키백과도 파일도 모르는 순수 함수라 작은 가짜 지도로 시험한다.

/** 출발·도착으로 쓰지 않는 제목. 날짜·목록처럼 게임으로 재미없거나, 사건·사고처럼 게임 소재로 부적절한 것 */
const BORING = [/^\d+년(대)?$/, /^\d+세기$/, /^\d+월( \d+일)?$/, /^기원전/, /목록|일람|연표/, /\(/, /^\d/]
const SENSITIVE =
  /사건|사고|참사|학살|테러|전쟁|대전$|내전|살인|자살|폭동|쿠데타|홀로코스트|나치|대통령|선거|정당|국회의원|성교|성기|섹스|체위|사정$|자위|포르노|성매매|매춘|마약|범죄|사형|위안부|지진|재난|전염병|팬데믹|감염증|암$|질환|장애|저격|암살|운동$|게이트$|스캔들|논란|의혹|파문|유두|유방|생식|염$|보수주의|진보주의|행정부|정부$|핵무기|히틀러|스탈린|마오쩌둥|김일성|김정일|김정은|무솔리니|문선명|귀두|음경|음낭|음핵|음순|포경수술|오르가슴|콘돔|낙태|강간|성폭력|성폭행|성범죄|성추행|성희롱|음란|불륜|유부녀|유부남|소라넷|N번방|n번방|성인물|폭발|폭탄|필로폰|메스암페타민|펜타닐|코카인|대마초|신천지|가정연합|사이비|죽음$|사망(?!선|유희)|의 처형$|^처형$|즉결처형|(?<!삼)성병(?!원|숙)|매독(?!스)|임질|에이즈|인간면역결핍|대혁명|문화혁명|정변|숙청|반란$|봉기$|항쟁|대기근|계엄/

/** 한글이 들어간 2~16자. 기호로 시작하는 제목(.hr 같은 도메인)은 빼고, 너무 긴 제목은 화면에서 잘린다 */
export function titleOk(title: string): boolean {
  return title.length >= 2 && title.length <= 16 && /[가-힣]/.test(title) && !BORING.some(re => re.test(title)) && !SENSITIVE.test(title)
}

/** 날짜, 요일, 목록 같은 정리용 문서. 정답 길로 지나가지도, 문이 되지도 않는다 */
export const BOOKKEEPING = /^(기원전 )?\d+년(대)?$|^(기원전 )?\d+세기$|^(\d+천년기|\d+월( \d+일)?|\d+일|[월화수목금토일]요일|년|월|세기)$|목록$|일람$|연표$/

const LANGUAGE = new RegExp(
  '^((고대|중세|현대|근대|고전|표준|교회|구어체|미국|영국|브라질|스위스|서부|동부|북부|남부) ?)*(' +
    '영어|한국어|조선어|일본어|중국어|광둥어|민난어|만주어|몽골어|라틴어|그리스어|프랑스어|독일어|스페인어|에스파냐어|포르투갈어|이탈리아어|러시아어|우크라이나어|벨라루스어|폴란드어|체코어|슬로바키아어' +
    '|헝가리어|루마니아어|불가리아어|세르비아어|세르보크로아트어|크로아티아어|슬로베니아어|알바니아어|네덜란드어|아프리칸스어|덴마크어|스웨덴어|노르웨이어|아이슬란드어|핀란드어|에스토니아어|라트비아어|리투아니아어' +
    '|아일랜드어|웨일스어|바스크어|카탈루냐어|튀르키예어|터키어|페르시아어|파슈토어|쿠르드어|아랍어|히브리어|아람어|산스크리트어|팔리어|힌디어|힌두스탄어|우르두어|벵골어|타밀어|네팔어|티베트어|버마어' +
    '|태국어|타이어|라오어|크메르어|베트남어|말레이어|인도네시아어|타갈로그어|필리핀어|스와힐리어|줄루어|카자흐어|우즈베크어|아제르바이잔어|아르메니아어|조지아어|에스페란토|인도유럽어족' +
    ')$',
)
/** 표기와 숫자 때문에 어느 문서에나 걸리는 링크 */
const NOTATION = /^(한자|정체자|간체자|로마자|국제 음성 기호|중국어 병음|한어 병음|가나 \(문자\)|ISO 639.*|ISO 3166.*|국제 표준 도서 번호|디지털 객체 식별자|협정 세계시|시간대|위키백과|제곱킬로미터)$/

/** 사람이 뜻으로 떠올려 누르지 않는 문서: "(영어: …)" 표기의 언어, 연도, 목록, 표기법. 정답 길로 지나가지 않는다 */
export const unthinkable = (title: string) => BOOKKEEPING.test(title) || LANGUAGE.test(title) || NOTATION.test(title)

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
 * 예상 난이도. 최단 거리(par)를 먼저 보고, 3번 거리는 그 거리로 가는 길의 수로 가른다.
 *   4번 이상 → 어려움, 3번이고 길 20개 이상 → 쉬움, 나머지 → 보통
 * 예전에는 4번이어도 길이 6개 이하이거나 도착으로 들어오는 링크가 150개 이하일 때만 어려움이었다.
 * 후보가 인기 문서라 둘 다 드물어서 어려움이 거의 나오지 않았다(2026-11-21, 대기열 58개 중 0개).
 * 링크 지도에는 게임이 지우는 링크도 있어 길의 수가 실제보다 많게 나온다. 실제 플레이 기록으로 기준을 고쳐 간다.
 */
export function difficultyOf(par: number, ways: number, _endIn: number): Difficulty {
  if (par >= 4) return 'hard'
  if (ways >= 20) return 'easy'
  return 'normal'
}

/**
 * 한 번 채울 때 난이도별로 몇 개를 만들지. 출제 요일(월화 쉬움, 수목금 보통, 주말 어려움)의 비율 2:3:2에 맞춘다.
 * 대기열이 요일과 같은 비율로 줄어 어느 난이도도 먼저 바닥나지 않는다.
 */
export function quotas(count: number): Record<Difficulty, number> {
  const easy = Math.round((count * 2) / 7)
  const hard = Math.round((count * 2) / 7)
  return { easy, normal: count - easy - hard, hard }
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

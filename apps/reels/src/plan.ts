// 릴스 C의 시간표. 녹화(public/rec/timeline.json)의 시각을 영상 시각으로 옮기는 규칙과 장면 경계를 한곳에 둔다.
import timeline from '../public/rec/timeline.json'

export const FPS = 30
export const W = 1080
export const H = 1920

/** 폰 화면 크기(캔버스 px). 화면을 거의 채우고, 세로 자리는 장면마다 카메라(CAMERA)가 정한다 */
export const S = 2.05 // CSS px → 캔버스 px
export const PHONE = { w: timeline.width * S, x: (W - timeline.width * S) / 2 }
export const PHONE_H = timeline.height * S
/** 폰을 세로 가운데 둘 때의 위쪽 자리 */
const CENTER_TOP = (H - PHONE_H) / 2

type Mark = { t: number; kind: string; x?: number; y?: number; label?: string }
const marks = timeline.marks as Mark[]
const at = (kind: string, label?: string) => {
  const m = marks.find(m => m.kind === kind && (label === undefined || m.label === label))
  if (!m) throw new Error(`timeline: ${kind} ${label ?? ''} 없음`)
  return m.t
}
/** 녹화의 한 시각(초)과 탭 자리. 이야기판이 녹화 끝부분을 쓸 때 쓴다 */
export const recAt = at
export const recTap = (label: string) => {
  const m = marks.find(m => m.kind === 'tap' && m.label === label)
  if (!m) throw new Error(`timeline: tap ${label} 없음`)
  return { t: m.t, x: m.x!, y: m.y! }
}
export const REC_END = timeline.duration

/** 녹화의 한 구간을 몇 배속으로 쓸지(rate), 또는 몇 초로 줄일지(dur). 문서를 여는 동안은 짧게 넘긴다 */
type Cut = { from: number; to: number; rate: number }
const loaded = (label: string) => at('loaded', label)
const tapAt = (label: string) => at('tap', label)
const rated = (from: number, to: number, rate: number): Cut => ({ from, to, rate })
const squeezed = (from: number, to: number, dur: number): Cut => ({ from, to, rate: Math.max(1, (to - from) / dur) })
const CUTS: Cut[] = [
  // 3장면: 홈 → 시작 → 출발 문서
  rated(0, tapAt('시작') + 0.45, 1.1),
  squeezed(tapAt('시작') + 0.45, loaded('불고기') + 0.6, 0.5),
  // 4장면: 게임. 문서를 보는 동안은 거의 제 속도로, 여는 동안은 0.4초로
  rated(loaded('불고기') + 0.6, at('move', '서울'), 1.25),
  squeezed(at('move', '서울'), loaded('서울특별시'), 0.4),
  rated(loaded('서울특별시'), at('move', '롯데월드타워'), 1.3),
  squeezed(at('move', '롯데월드타워'), loaded('롯데월드타워'), 0.4),
  rated(loaded('롯데월드타워'), at('back'), 1.15),
  rated(at('back'), at('move', '서울 이랜드 FC'), 1.4),
  squeezed(at('move', '서울 이랜드 FC'), loaded('서울 이랜드 FC'), 0.4),
  rated(loaded('서울 이랜드 FC'), at('move', '뉴발란스') + 0.25, 1.4),
  // 5장면: 도착(연속 기록 축하 화면은 건너뛴다)
  rated(at('arrival'), at('share') + 1.6, 1),
]

/**
 * 앞부분(만든 사람의 이야기) 시각. 녹화는 "직접 만들어 봤어요"에서 폰이 올라오며 시작한다.
 *   0       친구들과 꼬들·꼬맨틀 하던 대화방
 *   wave    파도타기: 문서 제목이 링크로 이어진다
 *   daily   매일 한 문제씩 친구들과 겨루기
 *   made    그래서 직접 만들었다(로고) → 폰이 올라온다
 */
export const INTRO = { chatOut: 4.3, wave: 4.5, daily: 9.8, made: 13.2, phoneIn: 14.4 }
export const REC_IN = INTRO.phoneIn

export type Segment = Cut & { out: number; frames: number; startFrame: number }
export const SEGMENTS: Segment[] = (() => {
  let out = REC_IN
  return CUTS.map(c => {
    const len = (c.to - c.from) / c.rate
    const startFrame = Math.round(out * FPS)
    const endFrame = Math.round((out + len) * FPS)
    const s = { ...c, out, frames: endFrame - startFrame, startFrame }
    out += len
    return s
  })
})()

/** 녹화 시각 → 영상 시각(초). 잘라 낸 곳이면 null */
export function recToOut(t: number): number | null {
  for (const s of SEGMENTS) if (t >= s.from && t <= s.to) return s.out + (t - s.from) / s.rate
  return null
}

const o = (t: number) => {
  const v = recToOut(t)
  if (v === null) throw new Error(`잘린 시각 ${t}`)
  return v
}

export const T = {
  chatIn: 0,
  recIn: REC_IN,
  game: o(loaded('불고기') + 0.5),
  moves: marks.filter(m => m.kind === 'move' || m.kind === 'back').map(m => o(m.t)),
  back: o(at('back')),
  arrival: o(at('arrival')),
  share: o(at('share')),
  recOut: SEGMENTS.at(-1)!.out + (SEGMENTS.at(-1)!.to - SEGMENTS.at(-1)!.from) / SEGMENTS.at(-1)!.rate,
}
/** 6장면(다시 채팅)과 7장면(끝 화면) */
export const T2 = { chatBack: T.recOut - 0.3, end: T.recOut + 3.2, total: T.recOut + 3.2 + 7.0 }
export const DURATION = Math.round(T2.total * FPS)

export const TAPS = marks
  .filter(m => m.kind === 'tap' && m.label !== 'celebration-done')
  .map(m => {
    // 탭 표시는 그 구간이 끝나면 함께 사라진다(다음 화면으로 번지지 않게)
    const seg = SEGMENTS.find(s => m.t >= s.from && m.t <= s.to)
    return { t: recToOut(m.t), until: seg ? seg.out + (seg.to - seg.from) / seg.rate : 0, x: m.x!, y: m.y! }
  })
  .filter((m): m is { t: number; until: number; x: number; y: number } => m.t !== null)

// 공유 문구에서 내 결과를 꺼낸다: "Linkle #5 🔗\n5번 21초\n\n🟥🟧⏪🟧🏁\n\n…"
const lines = (timeline.shareText ?? '').split('\n')
export const MINE = {
  title: lines[0] ?? 'Linkle #5 🔗',
  score: lines[1] ?? '',
  emoji: [...new Intl.Segmenter().segment(lines[3] ?? '')].map(s => s.segment),
  moves: Number((lines[1] ?? '').match(/^(\d+)번/)?.[1] ?? 0),
  time: (lines[1] ?? '').replace(/^\d+번\s*/, ''),
}
export const NUMBER = Number(MINE.title.match(/#(\d+)/)?.[1] ?? 5)
export const DOMAIN = 'linkle.naco.im'

/**
 * 카메라: 시각마다 폰의 위쪽 자리(캔버스 y). 바뀔 때는 0.6초 동안 부드럽게 옮겨 간다.
 * 평소에는 폰 전체가 보이게 가운데 두고, 누를 단추가 릴스 아래 글자 영역(1540 아래)에 걸리면 그때만 끌어올린다.
 */
const lift = (cssY: number) => 1450 - cssY * S // 그 CSS 높이가 캔버스 1450에 오도록
export const CHAT_TOP = 1560 - 776 * S // 대화방 맨 아래 말풍선이 1560에 오도록
const BACK_Y = (marks.find(m => m.kind === 'tap' && m.label === 'back')?.y ?? 812)
const SHARE_Y = (marks.find(m => m.kind === 'tap' && m.label === '결과 공유')?.y ?? 748)
export const CAMERA: Array<[number, number]> = [
  [0, CHAT_TOP],
  [INTRO.wave, CENTER_TOP], // 폰이 비켜 있는 동안 자리를 옮겨 둔다
  [T.back - 1.1, lift(BACK_Y)],
  [T.back + 0.5, CENTER_TOP],
  [T.share - 1.3, lift(SHARE_Y)],
  [T2.chatBack, CHAT_TOP],
]
export function cameraTop(sec: number) {
  let top = CAMERA[0]![1]
  for (const [at, to] of CAMERA) {
    if (sec < at) break
    const p = Math.min(1, (sec - at) / 0.6)
    const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
    top = top + (to - top) * e
  }
  return top
}

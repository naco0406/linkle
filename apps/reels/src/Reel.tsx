import { useEffect, useState, type ReactNode } from 'react'
import { AbsoluteFill, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import { Chat, type Msg } from './Chat'
import { Daily, Made, Wave } from './Intro'
import { Phone } from './Phone'
import { cameraTop, DOMAIN, FPS, H, INTRO, MINE, NUMBER, PHONE, PHONE_H, S, SEGMENTS, T, T2, TAPS } from './plan'
import { BRAND, C, FONT } from './theme'

export const FRIENDS = [
  { who: '동휘', score: '7번 2분 3초', emoji: '🟥🟨⏪🟧🟩🟦🏁' },
  { who: '민서', score: '4번 58초', emoji: '🟧🟨🟩🏁' },
  { who: '진우', score: '6번 1분 12초', emoji: '🟥🟧🟧⏪🟩🏁' },
]
export const TITLE = `Linkle #${NUMBER} 🔗`

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.33, 0, 0.2, 1)
/** a초에서 b초 사이 0→1 */
const ramp = (sec: number, a: number, b: number) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing: ease })

export function Reel() {
  const frame = useCurrentFrame()
  const sec = frame / FPS
  const top = cameraTop(sec)
  const pop = (at: number) => spring({ frame: frame - Math.round(at * FPS), fps: FPS, config: { damping: 16, stiffness: 170, mass: 0.7 } })

  // 1장면: 링클을 만들기 전, 친구들과 꼬들·꼬맨틀을 하던 대화방
  const intro: Msg[] = [
    { kind: 'text', who: '진우', text: '어제 꼬맨틀 진짜 어려웠음', p: 1 },
    { kind: 'text', who: '동휘', text: 'ㅇㅈ 200번 넘게 함', p: 1 },
    { kind: 'text', who: '민서', text: '오늘 꼬들 나왔다', p: 1 },
    { kind: 'text', who: '진우', text: '벌써?', p: 1 },
    { kind: 'text', who: '동휘', text: '나 3줄 컷', p: pop(0.2) },
    { kind: 'text', who: '민서', text: '꼬맨틀은 아직 못 맞힘', p: pop(0.9) },
    { kind: 'text', who: '진우', text: '힌트 좀 줘', p: pop(1.6) },
    { kind: 'text', who: '나', mine: true, text: '난 둘 다 끝냈지롱', p: pop(2.4) },
  ]
  // 끝 무렵: 링클이 생긴 뒤의 같은 대화방. 친구들은 먼저 올렸고, 내 결과와 진우의 답이 들어온다
  const after: Msg[] = [
    { kind: 'text', who: '민서', text: '오늘 링클 나왔다', p: 1 },
    ...FRIENDS.map(f => ({ kind: 'result' as const, who: f.who, title: TITLE, score: f.score, emoji: f.emoji, p: 1 })),
    { kind: 'result', who: '나', mine: true, title: TITLE, score: MINE.score, emoji: MINE.emoji.join(''), p: pop(T2.chatBack + 0.35) },
    { kind: 'text', who: '진우', text: `${MINE.time}?? 어떻게 감`, p: pop(T2.chatBack + 1.25) },
  ]
  const late = sec > INTRO.daily

  // 폰: 1장면 뒤에 비켜났다가, "직접 만들어 봤어요"에서 아래에서 올라온다
  const gone = ramp(sec, INTRO.chatOut - 0.3, INTRO.chatOut)
  const rise = ramp(sec, INTRO.phoneIn - 0.2, INTRO.phoneIn + 0.7)
  // 올라오기 전에는 그리지 않는다. 내려가 있는 거리도 캔버스 높이에 폰 위 여백을 더해, 테두리 끝이 화면 아래에 걸리지 않게 한다
  const phoneOpacity = late ? (rise > 0 ? 1 : 0) : 1 - gone
  const phoneShift = late ? (1 - rise) * (H + 120) : 40 * gone

  // 녹화와 대화방이 겹쳐 바뀌는 때
  const recOpacity = late ? 1 - ramp(sec, T2.chatBack, T2.chatBack + 0.2) : 0
  const endIn = ramp(sec, T2.end, T2.end + 0.45)

  return (
    <AbsoluteFill style={{ background: C.secondary, fontFamily: FONT }}>
      <Fonts />
      <Wave sec={sec} from={INTRO.wave} to={INTRO.daily} />
      <Daily sec={sec} from={INTRO.daily} to={INTRO.made} />
      <Made sec={sec} from={INTRO.made} to={INTRO.phoneIn + 0.3} Logo={Logo} />

      {phoneOpacity > 0 && (
        <div style={{ position: 'absolute', inset: 0, opacity: phoneOpacity, transform: `translateY(${phoneShift}px)` }}>
          <Phone top={top} background={C.chatBg}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${S})`, transformOrigin: '0 0' }}>
              {late ? <Chat msgs={after} domain={DOMAIN} date="11월 23일 월요일" /> : <Chat msgs={intro} domain={DOMAIN} date="2025년 1월 6일 월요일" />}
            </div>
            <div style={{ position: 'absolute', inset: 0, opacity: recOpacity }}>
              {SEGMENTS.map((s, i) => (
                <Sequence key={i} from={s.startFrame} durationInFrames={s.frames} layout="none">
                  <OffthreadVideo src={staticFile('rec/play.mp4')} trimBefore={Math.round(s.from * FPS)} playbackRate={s.rate} muted style={{ width: PHONE.w, height: PHONE_H, display: 'block' }} />
                </Sequence>
              ))}
              {TAPS.map((tap, i) => (
                <Tap key={i} sec={sec} at={tap.t} until={tap.until} x={tap.x * S} y={tap.y * S} />
              ))}
            </div>
          </Phone>
        </div>
      )}

      <Trail sec={sec} />

      {CAPTIONS.map((c, i) => (
        <Caption key={i} sec={sec} {...c} />
      ))}

      {endIn > 0 && <EndCard sec={sec} opacity={endIn} />}
    </AbsoluteFill>
  )
}

/** 누른 자리에 번지는 원 */
export function Tap({ sec, at, until, x, y }: { sec: number; at: number; until: number; x: number; y: number }) {
  const p = (sec - at + 0.08) / 0.45
  if (p < 0 || p > 1 || sec >= until) return null
  const r = 26 + 34 * Easing.out(Easing.cubic)(p)
  const press = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65
  return (
    <>
      <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 999, background: C.primary, opacity: 0.28 * press }} />
      <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: 999, border: `4px solid ${C.primary}`, opacity: 1 - p }} />
    </>
  )
}

/** 4장면: 지나온 문서마다 네모가 한 칸씩 붙는다(내 실제 결과) */
function Trail({ sec }: { sec: number }) {
  const show = ramp(sec, T.game - 0.1, T.game + 0.3) * (1 - ramp(sec, T.arrival - 0.35, T.arrival - 0.05))
  if (show <= 0) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, display: 'flex', justifyContent: 'center', opacity: show, transform: `translateY(${(1 - show) * 20}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 108, padding: '0 28px', borderRadius: 30, background: C.white, border: `4px solid ${C.primary}` }}>
        {MINE.emoji.map((e, i) => {
          const at = T.moves[i] ?? Infinity
          const p = ramp(sec, at + 0.05, at + 0.3)
          return (
            <span key={i} style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', fontSize: 56, lineHeight: 1, opacity: p > 0 ? 1 : 1, transform: `scale(${p > 0 ? 0.6 + 0.4 * Easing.out(Easing.back(2))(p) : 1})` }}>
              {p > 0 ? e : <span style={{ width: 52, height: 52, borderRadius: 10, border: `3px dashed ${C.lineBlue}` }} />}
            </span>
          )
        })}
      </div>
    </div>
  )
}

type Cap = { from: number; to: number; text: ReactNode; y?: number }
const CAPTION_Y = 1372
/** 대화방 장면은 말풍선이 아래에 쌓이므로 자막을 위에 둔다(방 이름 자리) */
const TOP_Y = 262
/** 앞부분 그림 장면의 자막 자리(두 줄이 위 220px 안쪽에 들어오게) */
const INTRO_Y = 330
const two = (a: string, b: string) => (
  <>
    {a}
    <br />
    {b}
  </>
)
const CAPTIONS: Cap[] = [
  { from: 0.15, to: INTRO.chatOut - 0.1, text: two('저는 친구들이랑 꼬들, 꼬맨틀 하면서', '노는 걸 참 좋아했어요'), y: TOP_Y },
  { from: INTRO.wave + 0.1, to: INTRO.daily - 0.1, text: two('그러다 어느 날', '‘나무위키 파도타기’라는 걸 봤어요'), y: INTRO_Y },
  { from: INTRO.daily + 0.1, to: INTRO.made - 0.1, text: two('매일 한 문제씩 친구들이랑 겨루면', '재밌을 것 같았어요'), y: INTRO_Y },
  { from: INTRO.made + 0.1, to: INTRO.phoneIn + 0.4, text: '그래서 직접 만들어 봤어요', y: INTRO_Y },
  { from: T.recIn + 0.8, to: T.game, text: '하루 한 문제, 모두 같은 문제를 풀어요' },
  { from: T.game, to: T.moves[0]! + 0.2, text: two('위키피디아 문서 속 링크만 눌러서', '목표 문서까지 가요') },
  { from: T.moves[0]! + 0.2, to: T.back - 0.1, text: '목표에 가까울수록 색이 파래져요' },
  { from: T.back - 0.1, to: T.back + 1.6, text: '길을 잘못 들면 ⏪ 되돌아가요' },
  { from: T.back + 1.6, to: T.arrival - 0.2, text: '목표 문서에 닿을 때까지 이어 가요' },
  { from: T.arrival + 0.15, to: T2.chatBack, text: '도착하면 지나온 길이 한눈에 보여요', y: 1010 },
  { from: T2.chatBack + 0.3, to: T2.end, text: '경로는 감추고, 결과만 네모로 겨뤄요', y: TOP_Y },
]

function Caption({ sec, from, to, text, y = CAPTION_Y }: Cap & { sec: number }) {
  if (sec < from - 0.01 || sec > to) return null
  const inP = ramp(sec, from, from + 0.18)
  const outP = ramp(sec, to - 0.12, to)
  const p = inP * (1 - outP)
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center', transform: `translateY(-50%) scale(${0.94 + 0.06 * inP})`, opacity: p }}>
      <div style={{ maxWidth: 960, padding: '20px 36px 22px', borderRadius: 30, background: C.primary, color: C.white, fontSize: 56, fontWeight: 800, lineHeight: 1.28, letterSpacing: '-0.02em', textAlign: 'center', wordBreak: 'keep-all' }}>{text}</div>
    </div>
  )
}

const GAP_BIG = 120

/** 끝 화면. question을 비우면(자막을 따로 넣을 때) 로고 묶음만 가운데에 둔다 */
export function EndCard({ sec, opacity, start = T2.end, question = '오늘의 문제, 아직 안 풀어봤죠?' }: { sec: number; opacity: number; start?: number; question?: ReactNode }) {
  const a = ramp(sec, start + 0.15, start + 0.6)
  const b = ramp(sec, start + 0.45, start + 0.9)
  const c = ramp(sec, start + 0.75, start + 1.2)
  const rise = (p: number) => ({ opacity: p, transform: `translateY(${(1 - p) * 24}px)` })
  return (
    <AbsoluteFill style={{ background: C.secondary, opacity, alignItems: 'center', justifyContent: 'center' }}>
      {/* 글자 상자를 글자 높이(lineHeight 1)에 맞춰, 보이는 간격이 margin 그대로 나오게 한다 */}
      {question && <p style={{ margin: 0, fontSize: 64, lineHeight: 1, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', ...rise(a) }}>{question}</p>}
      <div style={{ marginTop: question ? GAP_BIG : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', ...rise(b) }}>
        <Logo size={168} />
        <p style={{ margin: '44px 0 0', fontFamily: BRAND, fontSize: 132, lineHeight: 1, color: C.primary }}>Linkle</p>
        <p style={{ margin: '12px 0 0', fontSize: 40, lineHeight: 1, color: C.ink }}>매일 위키피디아 탐험하기</p>
      </div>
      <div style={{ marginTop: GAP_BIG - 7, height: 96, padding: '0 44px', borderRadius: 999, background: C.primary, color: C.white, fontSize: 46, lineHeight: 1, fontWeight: 700, display: 'flex', alignItems: 'center', ...rise(c) }}>{DOMAIN}</div>
    </AbsoluteFill>
  )
}

/** 파비콘과 같은 L 로고(apps/web/public/favicon.svg) */
export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill={C.primary} />
      <path d="M289 623 215 594V72H538L564 187H623V0H55V55L129 85V594L55 623V680H289Z" transform="translate(26.065 70) scale(0.06471 -0.06471)" fill="#fff" />
    </svg>
  )
}

/** 앱과 같은 글꼴을 받아 두고, 다 들어온 뒤에 찍는다.
 * 스타일시트가 먼저 들어와야 document.fonts.load가 실제 글꼴을 기다린다(아니면 대체 글꼴로 찍힐 수 있다) */
const FONT_CSS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css',
  'https://fonts.googleapis.com/css2?family=Rhodium+Libre&display=swap',
]
export function Fonts() {
  const [handle] = useState(() => delayRender('fonts', { timeoutInMilliseconds: 60_000 }))
  useEffect(() => {
    const sheets = FONT_CSS.map(
      href =>
        new Promise<void>(done => {
          const found = document.querySelector<HTMLLinkElement>(`link[href="${href}"]`)
          if (found?.sheet) return done()
          const link = found ?? Object.assign(document.createElement('link'), { rel: 'stylesheet', href })
          link.addEventListener('load', () => done(), { once: true })
          link.addEventListener('error', () => done(), { once: true })
          if (!found) document.head.appendChild(link)
        }),
    )
    void Promise.all(sheets)
      .then(() =>
        Promise.all([
          document.fonts.load('800 56px "Pretendard Variable"', '가'),
          document.fonts.load('400 16px "Pretendard Variable"', '가'),
          document.fonts.load('700 16px "Pretendard Variable"', '가'),
          document.fonts.load('132px "Rhodium Libre"', 'Linkle'),
        ]),
      )
      .then(() => document.fonts.ready)
      .catch(() => {})
      .finally(() => continueRender(handle))
  }, [handle])
  return null
}

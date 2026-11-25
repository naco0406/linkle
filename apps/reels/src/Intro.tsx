// 앞부분 그림: 파도타기(문서가 링크로 이어짐), 매일 한 문제씩 친구들과 겨루기, 그래서 만든 링클.
// 다른 서비스(꼬들, 꼬맨틀, 나무위키)의 화면이나 로고는 그리지 않는다. 평면 단색만 쓰고,
// 파도타기 장면만 나무위키 색(청록)이다. 다음 장면부터 링클 파랑으로 돌아온다.
import { Easing, interpolate } from 'remotion'
import { C, BRAND, NAMU } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.33, 0, 0.2, 1)
const ramp = (sec: number, a: number, b: number) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing: ease })
const back = Easing.out(Easing.back(1.8))

/** 장면 전체의 들어오고 나가는 정도 */
export const sceneIn = (sec: number, from: number, to: number) => ramp(sec, from, from + 0.35) * (1 - ramp(sec, to - 0.3, to))

// 예시로 쓰는 문서 사슬. 실제 오늘의 문제와는 상관없다
const CHAIN = ['고양이', '고대 이집트', '피라미드', '나폴레옹', '베토벤', '교향곡']
const CARD_H = 112
const XS = [-150, 140, -120, 160, -140, 120]
const Y0 = 620
const DY = 160

/** 파도타기: 제목 카드가 하나씩 나타나고, 앞 카드를 누르면 다음 카드로 선이 이어진다 */
export function Wave({ sec, from, to }: { sec: number; from: number; to: number }) {
  const show = sceneIn(sec, from, to)
  if (show <= 0) return null
  const at = (i: number) => from + 0.35 + i * 0.62
  const center = (i: number) => ({ x: 540 + XS[i]!, y: Y0 + i * DY })
  // 사슬이 화면 아래로 넘치지 않게 천천히 위로 흐른다
  const drift = -60 * ramp(sec, from, to)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: show, transform: `translateY(${drift}px)` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {CHAIN.slice(1).map((_, k) => {
          const i = k + 1
          const a = center(i - 1)
          const b = center(i)
          const p = ramp(sec, at(i) - 0.3, at(i))
          const y1 = a.y + CARD_H / 2
          const y2 = b.y - CARD_H / 2
          const d = `M ${a.x} ${y1} C ${a.x} ${y1 + 40}, ${b.x} ${y2 - 40}, ${b.x} ${y2}`
          return <path key={i} d={d} fill="none" stroke={NAMU.main} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} opacity={0.55} />
        })}
      </svg>
      {CHAIN.map((title, i) => {
        const p = ramp(sec, at(i), at(i) + 0.3)
        if (p <= 0) return null
        const c = center(i)
        const tapped = sec >= at(i + 1) - 0.35 && i < CHAIN.length - 1
        const tp = ramp(sec, at(i + 1) - 0.35, at(i + 1) + 0.1)
        return (
          <div key={i} style={{ position: 'absolute', left: c.x, top: c.y, transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * back(p)})`, opacity: p }}>
            <div style={{ height: CARD_H, padding: '0 44px', borderRadius: 999, background: tapped ? NAMU.soft : C.white, border: `3px solid ${tapped ? NAMU.line : NAMU.main}`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 50, fontWeight: 700, color: NAMU.main, textDecoration: 'underline', textUnderlineOffset: 10, textDecorationThickness: 4 }}>{title}</span>
            </div>
            {tapped && tp < 1 && (
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 80 + 80 * tp, height: 80 + 80 * tp, transform: 'translate(-50%, -50%)', borderRadius: 999, border: `5px solid ${NAMU.main}`, opacity: 1 - tp }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const PEOPLE = [
  { who: '동휘', color: '#5b8def', score: '7번' },
  { who: '민서', color: '#57ab5a', score: '4번' },
  { who: '진우', color: '#f0883e', score: '6번' },
  { who: '나', color: C.primary, score: '5번' },
]

/** 매일 한 문제씩 친구들과 겨루기: 오늘의 문제 카드와, 각자의 결과 */
export function Daily({ sec, from, to }: { sec: number; from: number; to: number }) {
  const show = sceneIn(sec, from, to)
  if (show <= 0) return null
  const a = ramp(sec, from + 0.1, from + 0.5)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: show, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 560 }}>
      <div style={{ width: 860, padding: '44px 48px 48px', borderRadius: 48, background: C.white, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: C.primary }}>오늘의 문제</span>
          <span style={{ fontFamily: BRAND, fontSize: 44, color: C.primary }}>#1</span>
        </div>
        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 24 }}>
          <Locked label="출발 문서" />
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', opacity: 0.6 }}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <Locked label="목표 문서" />
        </div>
      </div>
      <div style={{ marginTop: 56, display: 'flex', gap: 36 }}>
        {PEOPLE.map((p, i) => {
          const q = ramp(sec, from + 0.7 + i * 0.35, from + 1.0 + i * 0.35)
          const r = ramp(sec, from + 1.9 + i * 0.3, from + 2.15 + i * 0.3)
          return (
            <div key={p.who} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: q, transform: `translateY(${(1 - q) * 24}px)` }}>
              <span style={{ width: 132, height: 132, borderRadius: 999, background: p.color, color: C.white, display: 'grid', placeItems: 'center', fontSize: 52, fontWeight: 700, border: p.who === '나' ? `6px solid ${C.white}` : undefined, outline: p.who === '나' ? `4px solid ${C.primary}` : undefined }}>
                {p.who.slice(-1)}
              </span>
              <span style={{ marginTop: 16, fontSize: 36, color: C.ink }}>{p.who}</span>
              <span style={{ marginTop: 14, height: 64, minWidth: 116, padding: '0 22px', borderRadius: 999, background: C.white, border: `3px solid ${C.lineBlue}`, display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 700, color: C.primary, opacity: r, transform: `scale(${0.7 + 0.3 * back(r)})` }}>
                {p.score}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Locked({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, height: 112, borderRadius: 28, border: `3px dashed ${C.lineBlue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 38, color: C.ink2 }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      {label}
    </div>
  )
}

/** 그래서 만든 링클: 로고가 뜨고, 폰이 올라오면 위로 비켜 사라진다 */
export function Made({ sec, from, to, Logo }: { sec: number; from: number; to: number; Logo: (p: { size: number }) => React.ReactElement }) {
  const p = ramp(sec, from + 0.15, from + 0.6)
  const out = ramp(sec, to - 0.5, to)
  if (p <= 0 || out >= 1) return null
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: p * (1 - out), transform: `translateY(${-160 * out}px) scale(${0.85 + 0.15 * back(p)})` }}>
      <Logo size={200} />
      <p style={{ margin: '48px 0 0', fontFamily: BRAND, fontSize: 156, lineHeight: 1, color: C.primary }}>Linkle</p>
    </div>
  )
}

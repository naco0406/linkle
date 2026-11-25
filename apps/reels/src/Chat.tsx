// 대화방 화면(폰 안, CSS px 390×844 좌표). 특정 메신저를 흉내 내지 않고 링클 색으로 그린 중립적인 대화방이다.
// 메시지는 아래에서부터 쌓인다. 새 메시지가 들어오면(p: 0→1) 그 높이만큼 위의 것들이 밀려 올라간다.
import type { CSSProperties } from 'react'
import { C, FONT } from './theme'

export type Msg =
  | { kind: 'result'; who: string; mine?: boolean; title: string; score: string; emoji: string; p: number }
  | { kind: 'text'; who: string; mine?: boolean; text: string; p: number }

const HEADER = 56
const INPUT = 60
const LINE = 24
const PAD_Y = 12
const NAME = 18
const GAP = 14
export const CHAT = { headerH: HEADER, inputH: INPUT, bottom: 844 - INPUT - 12, lineH: LINE, padY: PAD_Y, nameH: NAME, gap: GAP, bubbleX: 60 }

/** 공유 결과 말풍선: 제목, 점수, (빈 줄), 네모, (빈 줄), 주소 — 6줄 */
export const RESULT_BUBBLE_H = LINE * 6 + PAD_Y * 2
const TEXT_BUBBLE_H = LINE + PAD_Y * 2

export function blockHeight(m: Msg) {
  const bubble = m.kind === 'result' ? RESULT_BUBBLE_H : TEXT_BUBBLE_H + LINE * (m.text.split('\n').length - 1)
  return (m.mine ? 0 : NAME + 4) + bubble
}

/** 메시지마다 놓일 세로 자리(완전히 들어왔을 때 기준이 아니라 지금 p를 반영한 자리) */
export function layout(msgs: Msg[], bottom = CHAT.bottom) {
  let y = bottom
  const out: number[] = []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!
    const h = (blockHeight(m) + GAP) * ease(m.p)
    y -= h
    out[i] = y + GAP * ease(m.p)
  }
  return out
}

const ease = (p: number) => Math.max(0, Math.min(1, p))

/**
 * 입력 줄의 상태. grow: 붙여 넣은 글이 들어가며 입력 칸이 커지는 정도(0→1), caret: 커서,
 * menu: "붙여넣기" 말풍선(0→1), send: 보내기 단추(0→1)
 */
export type Compose = { text: string; grow: number; caret: boolean; menu: number; send: number }

const FIELD_MIN = 38
const FIELD_LINE = 20
const FIELD_MAX = FIELD_LINE * 6 + 16
const barHeight = (grow: number) => 22 + FIELD_MIN + (FIELD_MAX - FIELD_MIN) * ease(grow)
/** 탭 표시를 그릴 자리(CSS px) */
export const COMPOSE_AT = {
  field: { x: 210, y: 844 - 11 - FIELD_MIN / 2 },
  menu: { x: 104, y: 844 - barHeight(0) - 30 },
  send: { x: 390 - 12 - 16, y: 844 - 11 - 16 },
}

export function Chat({ msgs, domain, date, compose }: { msgs: Msg[]; domain: string; date: string; compose?: Compose }) {
  const bar = barHeight(compose?.grow ?? 0)
  const ys = layout(msgs, 844 - bar - 12)
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.chatBg, fontFamily: FONT, color: C.ink, overflow: 'hidden' }}>
      {/* 날짜: 그날 첫 메시지 위에 붙어 함께 밀려 올라간다 */}
      <div style={{ position: 'absolute', top: (ys[0] ?? HEADER + 60) - 38, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: 'rgba(68,79,91,0.08)', fontSize: 12, color: C.ink2 }}>{date}</span>
      </div>

      {msgs.map((m, i) => (
        <Message key={i} m={m} y={ys[i]!} domain={domain} />
      ))}

      {/* 머리: 뒤로, 방 이름, 인원 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER, background: C.chatBg, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, borderBottom: `1px solid ${C.chatLine}` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <b style={{ fontSize: 17, fontWeight: 700 }}>링클 하는 사람들</b>
        <span style={{ fontSize: 15, color: C.ink2 }}>4</span>
      </div>

      {/* 입력 줄. 붙여 넣으면 입력 칸이 글 높이만큼 커지고 보내기 단추가 나온다 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bar, background: C.white, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '0 12px 11px', borderTop: `1px solid ${C.chatLine}` }}>
        <span style={{ width: 32, height: 32, marginBottom: 3, flex: 'none', borderRadius: 999, background: C.secondary, display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span style={{ position: 'relative', flex: 1, height: bar - 22, borderRadius: 19, background: C.secondary, overflow: 'hidden', padding: '8px 14px', fontSize: 15, lineHeight: `${FIELD_LINE}px`, color: C.ink, whiteSpace: 'pre' }}>
          {compose && compose.grow > 0 ? <span style={{ opacity: ease(compose.grow * 1.5) }}>{compose.text}</span> : null}
          {compose?.caret && <span style={{ position: 'absolute', left: 14, top: 9, width: 2, height: 20, borderRadius: 1, background: C.primary }} />}
        </span>
        {compose && compose.send > 0 && (
          <span style={{ width: 32 * ease(compose.send), height: 32, marginBottom: 3, flex: 'none', borderRadius: 999, background: C.primary, display: 'grid', placeItems: 'center', overflow: 'hidden', transform: `scale(${0.6 + 0.4 * ease(compose.send)})` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </span>
        )}
      </div>

      {/* "붙여넣기" 말풍선: 입력 칸을 누르면 그 위에 뜬다 */}
      {compose && compose.menu > 0 && (
        <div style={{ position: 'absolute', left: 64, top: 844 - bar - 48, opacity: ease(compose.menu), transform: `translateY(${(1 - ease(compose.menu)) * 6}px) scale(${0.9 + 0.1 * ease(compose.menu)})`, transformOrigin: '40px 44px' }}>
          <div style={{ height: 38, padding: '0 16px', borderRadius: 10, background: '#2b2f36', color: C.white, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center' }}>붙여넣기</div>
          <div style={{ position: 'absolute', left: 32, top: 37, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #2b2f36' }} />
        </div>
      )}
    </div>
  )
}

function Message({ m, y, domain }: { m: Msg; y: number; domain: string }) {
  const p = ease(m.p)
  if (p <= 0) return null
  const pop = 0.92 + 0.08 * p
  const wrap: CSSProperties = {
    position: 'absolute',
    top: y,
    left: m.mine ? undefined : 16,
    right: m.mine ? 16 : undefined,
    display: 'flex',
    gap: 8,
    opacity: p,
    transform: `translateY(${(1 - p) * 16}px) scale(${pop})`,
    transformOrigin: m.mine ? 'bottom right' : 'bottom left',
  }
  const bubble: CSSProperties = {
    padding: `${PAD_Y}px 14px`,
    borderRadius: 16,
    borderTopLeftRadius: m.mine ? 16 : 6,
    borderTopRightRadius: m.mine ? 6 : 16,
    background: m.mine ? C.primary : C.white,
    color: m.mine ? C.white : C.ink,
    fontSize: 16,
    lineHeight: `${LINE}px`,
    whiteSpace: 'pre',
  }
  return (
    <div style={wrap}>
      {!m.mine && <Avatar who={m.who} />}
      <div>
        {!m.mine && <div style={{ height: NAME, marginBottom: 4, fontSize: 13, lineHeight: `${NAME}px`, color: C.ink2 }}>{m.who}</div>}
        {m.kind === 'text' ? (
          <div style={bubble}>{m.text}</div>
        ) : (
          <div style={bubble}>
            <div style={{ fontWeight: 700 }}>{m.title}</div>
            <div>{m.score}</div>
            <div>&nbsp;</div>
            <div style={{ fontSize: 19, letterSpacing: 1 }}>{m.emoji}</div>
            <div>&nbsp;</div>
            <div style={{ color: m.mine ? 'rgba(255,255,255,0.85)' : C.primary, textDecoration: 'underline', textUnderlineOffset: 3 }}>{domain}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const AVATAR: Record<string, string> = { 동휘: '#5b8def', 민서: '#57ab5a', 진우: '#f0883e' }
function Avatar({ who }: { who: string }) {
  return (
    <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 999, background: AVATAR[who] ?? C.primary, color: C.white, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700 }}>
      {who.slice(-1)}
    </span>
  )
}

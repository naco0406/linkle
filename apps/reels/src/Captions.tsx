// 이야기판 자막. 줄마다 따로 감싸는 파란 블록이 위에서부터 차례로 왼쪽→오른쪽으로 펼쳐진다.
// 핵심어는 위키 링크처럼: 흰 바탕에 링클 파랑 글자, 밑줄. 그라데이션·그림자 없이 평면 단색만 쓴다.
import type { ReactNode } from 'react'
import { Easing, interpolate } from 'remotion'
import { C } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const outCubic = Easing.out(Easing.cubic)
const ramp = (sec: number, a: number, b: number, easing = outCubic) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing })

/** "[꼬들], [꼬맨틀] 하면서" → 글자와 핵심어 조각 */
export function parse(line: string): Array<{ text: string; key: boolean }> {
  return line.split(/(\[[^\]]+\])/).filter(Boolean).map(t => (t.startsWith('[') ? { text: t.slice(1, -1), key: true } : { text: t, key: false }))
}

export const CAPTION_TOP = 248 // 첫 줄 위쪽. 릴스 위 220px을 피한다
const SIZE = 54
const LINE_H = 96
const GAP = 12

export function StoryCaption({ sec, from, to, text, color = C.primary }: { sec: number; from: number; to: number; text: string; color?: string }) {
  if (sec < from || sec >= to) return null
  const lines = text.split('\n')
  const out = ramp(sec, to - 0.24, to, Easing.in(Easing.cubic))
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: CAPTION_TOP, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP, opacity: 1 - out, transform: `translateY(${-14 * out}px)` }}>
      {lines.map((line, i) => {
        const start = from + i * 0.11
        const wipe = ramp(sec, start, start + 0.34)
        const ink = ramp(sec, start + 0.08, start + 0.36)
        return (
          <div
            key={i}
            style={{
              height: LINE_H,
              padding: '0 30px',
              borderRadius: 24,
              background: color,
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0 round 24px)`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', fontSize: SIZE, fontWeight: 800, letterSpacing: '-0.03em', color: C.white, opacity: ink, transform: `translateX(${(1 - ink) * -14}px)` }}>
              {parse(line).map((part, j, parts) => {
                if (!part.key) return <span key={j} style={{ whiteSpace: 'pre' }}>{part.text}</span>
                // 바로 뒤에 조사가 붙으면("로", "라는") 칩 오른쪽 틈을 줄여 한 낱말로 읽히게 한다
                const glued = !!parts[j + 1] && !/^[\s,]/.test(parts[j + 1]!.text)
                return (
                  <Key key={j} sec={sec} at={start + 0.3} color={color} glued={glued}>
                    {part.text}
                  </Key>
                )
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 핵심어: 위키 링크 모양. 줄이 펼쳐진 뒤 살짝 튀어 오른다 */
function Key({ sec, at, color, glued, children }: { sec: number; at: number; color: string; glued: boolean; children: ReactNode }) {
  const p = ramp(sec, at, at + 0.28, Easing.out(Easing.back(2.2)))
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 76,
        margin: glued ? '0 2px 0 4px' : '0 4px',
        padding: '0 14px 4px',
        borderRadius: 14,
        background: C.white,
        color,
        textDecoration: 'underline',
        textDecorationThickness: 3,
        textUnderlineOffset: 6,
        transform: `scale(${0.9 + 0.1 * p})`,
      }}
    >
      {children}
    </span>
  )
}

/** 끝 화면 제목: 같은 규칙(핵심어만 파랑 밑줄)을 블록 없이 글자로 */
export function EndTitle({ text }: { text: string }) {
  return (
    <>
      {parse(text).map((part, j) =>
        part.key ? (
          <span key={j} style={{ color: C.primary, textDecoration: 'underline', textDecorationThickness: 5, textUnderlineOffset: 12 }}>
            {part.text}
          </span>
        ) : (
          <span key={j}>{part.text}</span>
        ),
      )}
    </>
  )
}

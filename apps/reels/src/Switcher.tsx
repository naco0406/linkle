// 앱 전환. 두 릴스가 함께 쓴다
import type React from 'react'
import { Easing, interpolate } from 'remotion'
import { PHONE } from './plan'
import { Logo } from './Reel'
import { C } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.33, 0, 0.2, 1)
const ramp = (sec: number, a: number, b: number) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing: ease })

/**
 * 앱 전환. 링클 화면이 카드로 작아지고(1), 카드들이 오른쪽으로 밀려 왼쪽의 채팅 카드가 가운데로 오고(2), 그 카드가 다시 화면을 채운다(3).
 * 아이폰의 앱 전환 움직임만 빌리고, 실제 앱 아이콘이나 화면은 그리지 않는다.
 */
export function Switcher({ sec, at, linkle, chat }: { sec: number; at: number; linkle: React.ReactNode; chat: React.ReactNode }) {
  const s0 = at
  const p1 = ramp(sec, s0, s0 + 0.45)
  const p2 = ramp(sec, s0 + 0.5, s0 + 1.1)
  const p3 = ramp(sec, s0 + 1.15, s0 + 1.75)
  if (p1 <= 0) return <>{linkle}</>
  const small = 0.62
  const gap = 44
  const step = PHONE.w * small + gap
  const lScale = 1 - (1 - small) * p1
  const cScale = small + (1 - small) * p3
  const lx = step * p2 + PHONE.w * 0.7 * p3
  const cx = -step * (1 - p2)
  const dy = 36 * p1 * (1 - p3)
  const labels = p1 * (1 - p3)
  const card = (x: number, scale: number, children: React.ReactNode, label: React.ReactNode) => (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${x}px, ${dy}px) scale(${scale})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 72, overflow: 'hidden' }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, top: -112, height: 80, display: 'flex', alignItems: 'center', gap: 20, opacity: labels, color: C.white, fontSize: 44, fontWeight: 600 }}>{label}</div>
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#243049' }}>
      {card(
        lx,
        lScale,
        linkle,
        <>
          <Logo size={80} />
          Linkle
        </>,
      )}
      {card(
        cx,
        cScale,
        chat,
        <>
          <ChatIcon />
          채팅
        </>,
      )}
    </div>
  )
}

/** 특정 메신저를 닮지 않은 채팅 아이콘 */
export function ChatIcon() {
  return (
    <svg width={80} height={80} viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill="#57ab5a" />
      <path d="M26 34a10 10 0 0 1 10-10h24a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H44l-12 10v-10a10 10 0 0 1-6-9z" fill="#fff" />
    </svg>
  )
}

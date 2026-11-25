// 폰 테두리와 화면을 한 요소로 그린다. 화면은 테두리(border) 안쪽에서 잘리므로
// 바깥 모서리(RADIUS)와 화면 모서리(RADIUS - BEZEL)가 정확히 같은 중심을 갖고, 사이에 틈이나 머리카락 선이 생기지 않는다.
import type { ReactNode } from 'react'
import { PHONE, PHONE_H } from './plan'

export const BEZEL = 14
const RADIUS = 86
const BEZEL_COLOR = '#1c2330'

export function Phone({ top, children, background = '#ffffff' }: { top: number; children: ReactNode; background?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE.x - BEZEL,
        top: top - BEZEL,
        width: PHONE.w + BEZEL * 2,
        height: PHONE_H + BEZEL * 2,
        boxSizing: 'border-box',
        border: `${BEZEL}px solid ${BEZEL_COLOR}`,
        borderRadius: RADIUS,
        background,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

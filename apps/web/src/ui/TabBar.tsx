import type { CSSProperties } from 'react'
import { CalendarDays, House, Trophy, Users, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import './tabbar.css'

type Tab = { to: string; label: string; icon: LucideIcon }

export const TABS: readonly Tab[] = [
  { to: '/', label: '오늘', icon: House },
  { to: '/yesterday', label: '어제의 기록', icon: Trophy },
  { to: '/archive', label: '지난 문제', icon: CalendarDays },
  { to: '/community', label: '커뮤니티', icon: Users },
]

/** 주소가 어느 탭에 속하는지. "/archive/12"도 지난 문제 탭이다 */
export function tabIndexOf(pathname: string): number {
  return TABS.findIndex(t => (t.to === '/' ? pathname === '/' : pathname === t.to || pathname.startsWith(`${t.to}/`)))
}

/**
 * 떠 있는 유리 탭. 세로로 긴 화면에서는 아래 가운데에, 넓은 화면과 눕힌 휴대폰에서는 왼쪽에 선다.
 * 놓이는 자리와 모양은 tabbar.css의 미디어 쿼리가 정한다.
 */
export function TabBar() {
  const index = tabIndexOf(useLocation().pathname)
  const style = { '--tab-count': TABS.length, '--tab-index': Math.max(index, 0) } as CSSProperties
  return (
    <nav className="tabbar" aria-label="주요 화면" style={style} data-none={index < 0}>
      <span className="tabbar__thumb" aria-hidden />
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="tabbar__item" aria-label={label}>
          <Icon strokeWidth={1.75} aria-hidden />
          <span className="tabbar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
